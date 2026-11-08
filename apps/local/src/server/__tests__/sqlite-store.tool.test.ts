import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describeStoreContract } from '@top-right/store/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openSqliteStore } from '../sqlite-store.ts';

describeStoreContract('SqliteStore', () => {
  const store = openSqliteStore(':memory:');
  return { store, close: () => store.close() };
});

describe('SqliteStore on a file', () => {
  const at = '2026-11-08T10:00:00.000Z';
  let directory: string;
  let file: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'top-right-store-'));
    file = path.join(directory, 'top-right.sqlite');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true });
  });

  it('reads back after the file is closed and reopened what was written before', async () => {
    const before = openSqliteStore(file);
    await before.writeScores('github:author', 'owner/repo#1', { urgency: 3, impact: 4, effort: 5 }, 'author', at);
    await before.writeStatusOverride('github:author', 'owner/repo#1', {
      status: 'in-progress',
      sourceState: 'open',
      at,
    });
    await before.writeLastVisit('github:author', at);
    const written = await before.readUserState('github:author');
    before.close();

    const after = openSqliteStore(file);
    await expect(after.readUserState('github:author')).resolves.toEqual(written);
    after.close();
  });

  it('does not reapply a migration to a migrated file', () => {
    openSqliteStore(file).close();
    const reopened = openSqliteStore(file);
    reopened.close();

    using db = new DatabaseSync(file);
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
  });

  it('migrates a version-1 file and keeps its scores', async () => {
    createVersion1File(file);
    {
      using db = new DatabaseSync(file);
      db.prepare(
        `INSERT INTO scores (user_id, item_key, field, value, scored_by, scored_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('github:author', 'owner/repo#1', 'urgency', 3, 'author', at);
    }

    const store = openSqliteStore(file);
    await expect(store.readUserState('github:author')).resolves.toMatchObject({
      scores: { 'owner/repo#1': { urgency: { value: 3, by: 'author', at } } },
    });
    store.close();
  });

  it('serves the version-1 statements on a migrated file', async () => {
    const store = openSqliteStore(file);
    await store.writeScores('github:author', 'owner/repo#1', { urgency: 2 }, 'author', at);
    await store.writeScores('github:author', 'owner/repo#1', { urgency: 4 }, 'agent', at);
    store.close();

    using db = new DatabaseSync(file);
    db.prepare(VERSION_1_UPSERT_SCORE).run('github:author', 'owner/repo#1', 'impact', 5, 'author', at);
    expect(db.prepare(VERSION_1_SELECT_SCORES).all('github:author')).toEqual([
      { item_key: 'owner/repo#1', field: 'impact', value: 5, scored_by: 'author', scored_at: at },
      { item_key: 'owner/repo#1', field: 'urgency', value: 4, scored_by: 'agent', scored_at: at },
    ]);
  });
});

// region | Helpers
/** The score statements of the version-1 store, which code on `main` still runs against a migrated file. */
const VERSION_1_SELECT_SCORES =
  'SELECT item_key, field, value, scored_by, scored_at FROM scores WHERE user_id = ? ORDER BY item_key, field';
const VERSION_1_UPSERT_SCORE = `INSERT INTO scores (user_id, item_key, field, value, scored_by, scored_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, item_key, field)
     DO UPDATE SET value = excluded.value, scored_by = excluded.scored_by, scored_at = excluded.scored_at`;

/** Creates the schema of version 1 at `file`. */
function createVersion1File(file: string): void {
  using db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE scores (
      user_id TEXT NOT NULL, item_key TEXT NOT NULL, field TEXT NOT NULL, value REAL NOT NULL,
      scored_by TEXT NOT NULL, scored_at TEXT NOT NULL, PRIMARY KEY (user_id, item_key, field)
    ) STRICT;
    CREATE TABLE status_overrides (
      user_id TEXT NOT NULL, item_key TEXT NOT NULL, status TEXT NOT NULL, source_state TEXT NOT NULL,
      set_at TEXT NOT NULL, PRIMARY KEY (user_id, item_key)
    ) STRICT;
    CREATE TABLE visits (user_id TEXT PRIMARY KEY, last_visit_at TEXT NOT NULL) STRICT;
    PRAGMA user_version = 1;
  `);
}
// endregion | Helpers
