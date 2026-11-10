import { DatabaseSync } from 'node:sqlite';

import {
  applyScoreWrite,
  isValidScore,
  type ItemScores,
  keepItemScores,
  SCORE_FIELDS,
  type ScoreEntry,
  type ScoreField,
  type ScoreLabelMapping,
  type Scorer,
  type Scores,
  type ScoreTypes,
  type StatusOverride,
  type WorkTypeMapping,
} from '@top-right/model';
import type { Store, UserState } from '@top-right/store';
import { z } from 'zod';

/** A `Store` on a SQLite file, with the function that closes the file. */
export interface SqliteStore extends Store {
  close: () => void;
}

/** Schema migrations, applied in order; migration `n` brings `PRAGMA user_version` to `n + 1`. */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE scores (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    field TEXT NOT NULL,
    value REAL NOT NULL,
    scored_by TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_key, field)
  ) STRICT;
  CREATE TABLE status_overrides (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    status TEXT NOT NULL,
    source_state TEXT NOT NULL,
    set_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_key)
  ) STRICT;
  CREATE TABLE visits (
    user_id TEXT PRIMARY KEY,
    last_visit_at TEXT NOT NULL
  ) STRICT;
  `,
  'ALTER TABLE scores ADD COLUMN previous_value REAL;',
  `
  CREATE TABLE settings (
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
  ) STRICT;
  `,
  `
  DROP TABLE scores;
  CREATE TABLE scores (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    field TEXT NOT NULL CHECK (field IN ('effort', 'progress', 'urgency', 'value')),
    score ANY NOT NULL,
    scored_by TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    previous_score ANY,
    PRIMARY KEY (user_id, item_key, field),
    CHECK (
      CASE field
        WHEN 'urgency' THEN score IN ('low', 'medium', 'high', 'critical')
        WHEN 'value' THEN score IN ('questionable', 'nice-to-have', 'should-have', 'must-have')
        ELSE typeof(score) IN ('integer', 'real')
      END
    ),
    CHECK (
      previous_score IS NULL OR CASE field
        WHEN 'urgency' THEN previous_score IN ('low', 'medium', 'high', 'critical')
        WHEN 'value' THEN previous_score IN ('questionable', 'nice-to-have', 'should-have', 'must-have')
        ELSE typeof(previous_score) IN ('integer', 'real')
      END
    )
  ) STRICT;
  `,
];

/** The name of each setting in the `settings` table, whose `value` holds the setting as JSON. */
const ABBREVIATIONS_SETTING = 'abbreviations';
const SCORE_LABEL_MAPPING_SETTING = 'score-label-mapping';
const WORK_TYPE_MAPPING_SETTING = 'work-type-mapping';

/** How long a statement waits for another process's lock on the file before it fails. */
const BUSY_TIMEOUT_MS = 5000;

const scoreRowSchema = z.object({
  item_key: z.string(),
  field: z.enum(['effort', 'progress', 'urgency', 'value']),
  score: z.union([z.number(), z.string()]),
  scored_by: z.enum(['agent', 'author']),
  scored_at: z.string(),
  previous_score: z.union([z.number(), z.string()]).nullable(),
});

const overrideRowSchema = z.object({
  item_key: z.string(),
  status: z.enum(['in-progress', 'to-do']),
  source_state: z.enum(['closed', 'open']),
  set_at: z.string(),
});

const visitRowSchema = z.object({ last_visit_at: z.string() });

const userVersionSchema = z.object({ user_version: z.number() });

const settingRowSchema = z.object({ value: z.string() });

const labelsSchema = z.array(z.string());

const workTypeMappingSchema = z.object({
  bug: labelsSchema,
  feature: labelsSchema,
  ops: labelsSchema,
  task: labelsSchema,
});

const scoreLabelMappingSchema = z.object({
  urgency: z.object({ critical: labelsSchema, high: labelsSchema, low: labelsSchema, medium: labelsSchema }),
  value: z.object({
    'must-have': labelsSchema,
    'nice-to-have': labelsSchema,
    questionable: labelsSchema,
    'should-have': labelsSchema,
  }),
});

const abbreviationsSchema = z.record(z.string(), z.string());

/** Opens the SQLite store at `path` (`:memory:` for a store that lives as long as the process), migrating it. */
export function openSqliteStore(path: string): SqliteStore {
  const db = new DatabaseSync(path, { timeout: BUSY_TIMEOUT_MS });
  migrate(db);

  const selectScores = db.prepare(
    `SELECT item_key, field, score, scored_by, scored_at, previous_score FROM scores
     WHERE user_id = ? ORDER BY item_key, field`,
  );
  const selectItemScores = db.prepare(
    `SELECT item_key, field, score, scored_by, scored_at, previous_score FROM scores
     WHERE user_id = ? AND item_key = ?`,
  );
  const deleteItemScores = db.prepare('DELETE FROM scores WHERE user_id = ? AND item_key = ?');
  const insertScore = db.prepare(
    `INSERT INTO scores (user_id, item_key, field, score, scored_by, scored_at, previous_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  /** Reads the item's scores, applies `update` to them, and replaces the stored rows, in one transaction. */
  function updateItemScores(userId: string, itemKey: string, update: (existing: ItemScores) => ItemScores): ItemScores {
    let result: ItemScores = {};
    runInTransaction(db, () => {
      result = update(readItemScores(z.array(scoreRowSchema).parse(selectItemScores.all(userId, itemKey))));
      deleteItemScores.run(userId, itemKey);
      for (const field of SCORE_FIELDS) {
        const entry = result[field];
        if (entry) insertScore.run(userId, itemKey, field, entry.score, entry.by, entry.at, entry.previous ?? null);
      }
    });
    return result;
  }
  const selectOverrides = db.prepare(
    'SELECT item_key, status, source_state, set_at FROM status_overrides WHERE user_id = ?',
  );
  const upsertOverride = db.prepare(
    `INSERT INTO status_overrides (user_id, item_key, status, source_state, set_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, item_key)
     DO UPDATE SET status = excluded.status, source_state = excluded.source_state, set_at = excluded.set_at`,
  );
  const deleteOverride = db.prepare('DELETE FROM status_overrides WHERE user_id = ? AND item_key = ?');
  const selectVisit = db.prepare('SELECT last_visit_at FROM visits WHERE user_id = ?');
  const upsertVisit = db.prepare(
    `INSERT INTO visits (user_id, last_visit_at) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET last_visit_at = excluded.last_visit_at`,
  );
  const selectSetting = db.prepare('SELECT value FROM settings WHERE user_id = ? AND name = ?');
  const upsertSetting = db.prepare(
    `INSERT INTO settings (user_id, name, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, name) DO UPDATE SET value = excluded.value`,
  );
  const deleteSetting = db.prepare('DELETE FROM settings WHERE user_id = ? AND name = ?');

  /** Reads a setting, treating a value that fails `schema` as absent so that a corrupt row cannot stop a read. */
  function readSetting<T>(userId: string, name: string, schema: z.ZodType<T>): T | undefined {
    const row = settingRowSchema.optional().parse(selectSetting.get(userId, name));
    if (!row) return undefined;
    let json: unknown;
    try {
      json = JSON.parse(row.value);
    } catch {
      json = undefined;
    }
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
    console.warn(`top-right: the stored "${name}" setting of ${userId} is invalid and is ignored.`);
    return undefined;
  }

  return {
    keepScores(userId: string, itemKey: string, at: string): Promise<ItemScores> {
      return Promise.resolve(updateItemScores(userId, itemKey, (existing) => keepItemScores(existing, at)));
    },

    readUserState(userId: string): Promise<UserState> {
      const scores: Record<string, ItemScores> = {};
      const scoreRows = z.array(scoreRowSchema).parse(selectScores.all(userId));
      for (const row of scoreRows) {
        scores[row.item_key] = addEntry(scores[row.item_key], row);
      }
      const overrides: Record<string, StatusOverride> = {};
      const overrideRows = z.array(overrideRowSchema).parse(selectOverrides.all(userId));
      for (const row of overrideRows) {
        overrides[row.item_key] = { status: row.status, sourceState: row.source_state, at: row.set_at };
      }
      const visit = visitRowSchema.optional().parse(selectVisit.get(userId));
      return Promise.resolve({
        scores,
        overrides,
        lastVisitAt: visit?.last_visit_at,
        workTypeMapping: readSetting(userId, WORK_TYPE_MAPPING_SETTING, workTypeMappingSchema),
        scoreLabelMapping: readSetting(userId, SCORE_LABEL_MAPPING_SETTING, scoreLabelMappingSchema),
        abbreviations: readSetting(userId, ABBREVIATIONS_SETTING, abbreviationsSchema) ?? {},
      });
    },

    writeAbbreviations(userId: string, abbreviations: Readonly<Record<string, string>>): Promise<void> {
      upsertSetting.run(userId, ABBREVIATIONS_SETTING, JSON.stringify(abbreviations));
      return Promise.resolve();
    },

    writeScores(userId: string, itemKey: string, values: Scores, by: Scorer, at: string): Promise<ItemScores> {
      return Promise.resolve(
        updateItemScores(userId, itemKey, (existing) => applyScoreWrite(existing, values, by, at)),
      );
    },

    writeScoreLabelMapping(userId: string, mapping: ScoreLabelMapping | undefined): Promise<void> {
      if (mapping) upsertSetting.run(userId, SCORE_LABEL_MAPPING_SETTING, JSON.stringify(mapping));
      else deleteSetting.run(userId, SCORE_LABEL_MAPPING_SETTING);
      return Promise.resolve();
    },

    writeStatusOverride(userId: string, itemKey: string, override: StatusOverride | undefined): Promise<void> {
      if (override) upsertOverride.run(userId, itemKey, override.status, override.sourceState, override.at);
      else deleteOverride.run(userId, itemKey);
      return Promise.resolve();
    },

    writeLastVisit(userId: string, at: string): Promise<void> {
      upsertVisit.run(userId, at);
      return Promise.resolve();
    },

    writeWorkTypeMapping(userId: string, mapping: WorkTypeMapping | undefined): Promise<void> {
      if (mapping) upsertSetting.run(userId, WORK_TYPE_MAPPING_SETTING, JSON.stringify(mapping));
      else deleteSetting.run(userId, WORK_TYPE_MAPPING_SETTING);
      return Promise.resolve();
    },

    close(): void {
      db.close();
    },
  };
}

// region | Helpers
/** Returns `scores` with the entry that `row` holds. */
function addEntry(scores: ItemScores | undefined, row: z.infer<typeof scoreRowSchema>): ItemScores {
  switch (row.field) {
    case 'effort':
      return { ...scores, effort: readEntry('effort', row) };
    case 'progress':
      return { ...scores, progress: readEntry('progress', row) };
    case 'urgency':
      return { ...scores, urgency: readEntry('urgency', row) };
    case 'value':
      return { ...scores, value: readEntry('value', row) };
  }
}

/** Applies each migration that the database's `user_version` has not reached, each in its own transaction. */
function migrate(db: DatabaseSync): void {
  const { user_version: version } = userVersionSchema.parse(db.prepare('PRAGMA user_version').get());
  for (let index = version; index < MIGRATIONS.length; index += 1) {
    runInTransaction(db, () => {
      db.exec(MIGRATIONS[index] ?? '');
      db.exec(`PRAGMA user_version = ${index + 1}`);
    });
  }
}

/** Returns the row's entry, or throws when a score is off the scale of `field`, which the table's checks prevent. */
function readEntry<F extends ScoreField>(field: F, row: z.infer<typeof scoreRowSchema>): ScoreEntry<ScoreTypes[F]> {
  const { score, previous_score: previous } = row;
  if (!isValidScore(field, score) || (previous !== null && !isValidScore(field, previous))) {
    throw new Error(`The store holds a ${field} score off its scale for ${row.item_key}`);
  }
  return { score, by: row.scored_by, at: row.scored_at, ...(previous !== null && { previous }) };
}

/** Returns the scores of the rows' item. */
function readItemScores(rows: ReadonlyArray<z.infer<typeof scoreRowSchema>>): ItemScores {
  let itemScores: ItemScores = {};
  for (const row of rows) itemScores = addEntry(itemScores, row);
  return itemScores;
}

function runInTransaction(db: DatabaseSync, work: () => void): void {
  db.exec('BEGIN');
  try {
    work();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
// endregion | Helpers
