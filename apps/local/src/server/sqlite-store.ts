import { DatabaseSync } from 'node:sqlite';

import { type ItemScores, SCORE_FIELDS, type Scorer, type Scores, type StatusOverride } from '@top-right/model';
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
];

const scoreRowSchema = z.object({
  item_key: z.string(),
  field: z.enum(['effort', 'impact', 'progress', 'urgency']),
  value: z.number(),
  scored_by: z.enum(['agent', 'author']),
  scored_at: z.string(),
});

const overrideRowSchema = z.object({
  item_key: z.string(),
  status: z.enum(['in-progress', 'to-do']),
  source_state: z.enum(['closed', 'open']),
  set_at: z.string(),
});

const visitRowSchema = z.object({ last_visit_at: z.string() });

const userVersionSchema = z.object({ user_version: z.number() });

/** Opens the SQLite store at `path` (`:memory:` for a store that lives as long as the process), migrating it. */
export function openSqliteStore(path: string): SqliteStore {
  const db = new DatabaseSync(path);
  migrate(db);

  const selectScores = db.prepare(
    'SELECT item_key, field, value, scored_by, scored_at FROM scores WHERE user_id = ? ORDER BY item_key, field',
  );
  const selectItemScores = db.prepare(
    'SELECT item_key, field, value, scored_by, scored_at FROM scores WHERE user_id = ? AND item_key = ?',
  );
  const upsertScore = db.prepare(
    `INSERT INTO scores (user_id, item_key, field, value, scored_by, scored_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, item_key, field)
     DO UPDATE SET value = excluded.value, scored_by = excluded.scored_by, scored_at = excluded.scored_at`,
  );
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

  return {
    readUserState(userId: string): Promise<UserState> {
      const scores: Record<string, ItemScores> = {};
      const scoreRows = z.array(scoreRowSchema).parse(selectScores.all(userId));
      for (const row of scoreRows) {
        const itemScores = (scores[row.item_key] ??= {});
        itemScores[row.field] = { value: row.value, by: row.scored_by, at: row.scored_at };
      }
      const overrides: Record<string, StatusOverride> = {};
      const overrideRows = z.array(overrideRowSchema).parse(selectOverrides.all(userId));
      for (const row of overrideRows) {
        overrides[row.item_key] = { status: row.status, sourceState: row.source_state, at: row.set_at };
      }
      const visit = visitRowSchema.optional().parse(selectVisit.get(userId));
      return Promise.resolve({ scores, overrides, lastVisitAt: visit?.last_visit_at });
    },

    writeScores(userId: string, itemKey: string, values: Scores, by: Scorer, at: string): Promise<ItemScores> {
      runInTransaction(db, () => {
        for (const field of SCORE_FIELDS) {
          const value = values[field];
          if (value !== undefined) upsertScore.run(userId, itemKey, field, value, by, at);
        }
      });
      const itemScores: ItemScores = {};
      const scoreRows = z.array(scoreRowSchema).parse(selectItemScores.all(userId, itemKey));
      for (const row of scoreRows) {
        itemScores[row.field] = { value: row.value, by: row.scored_by, at: row.scored_at };
      }
      return Promise.resolve(itemScores);
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

    close(): void {
      db.close();
    },
  };
}

// region | Helpers
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
