import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describeStoreContract } from '@top-right/store/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    await before.writeScores(
      'github:author',
      'owner/repo#1',
      { urgency: 'high', value: 'should-have', effort: 5 },
      'author',
      at,
    );
    await before.writeStatusOverride('github:author', 'owner/repo#1', {
      status: 'in-progress',
      sourceState: 'open',
      at,
    });
    await before.writeLastVisit('github:author', at);
    await before.writeWorkTypeMapping('github:author', { bug: ['defect'], feature: [], ops: [], task: [] });
    await before.writeAbbreviations('github:author', { 'owner/repo': 'r' });
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
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 4 });
  });

  it('migrates a version-1 file, dropping its 1 to 5 scores and keeping its other records', async () => {
    createVersion1File(file);
    {
      using db = new DatabaseSync(file);
      db.prepare(
        `INSERT INTO scores (user_id, item_key, field, value, scored_by, scored_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('github:author', 'owner/repo#1', 'impact', 3, 'author', at);
      db.prepare('INSERT INTO visits (user_id, last_visit_at) VALUES (?, ?)').run('github:author', at);
    }

    const store = openSqliteStore(file);
    await expect(store.readUserState('github:author')).resolves.toMatchObject({ scores: {}, lastVisitAt: at });
    await store.writeScores('github:author', 'owner/repo#1', { value: 'must-have' }, 'author', at);
    await expect(store.readUserState('github:author')).resolves.toMatchObject({
      scores: { 'owner/repo#1': { value: { score: 'must-have', by: 'author', at } } },
    });
    store.close();
  });

  it.each([
    { field: 'urgency', score: 'must-have' },
    { field: 'value', score: 'critical' },
    { field: 'value', score: 3 },
    { field: 'effort', score: 'high' },
    { field: 'impact', score: 3 },
  ])('refuses a row whose $field score is $score', ({ field, score }) => {
    openSqliteStore(file).close();

    using db = new DatabaseSync(file);
    expect(() =>
      db
        .prepare('INSERT INTO scores (user_id, item_key, field, score, scored_by, scored_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('github:author', 'owner/repo#1', field, score, 'author', at),
    ).toThrow(/CHECK constraint failed/);
  });

  it('ignores a stored setting that is not valid, with a warning', async () => {
    const store = openSqliteStore(file);
    await store.writeAbbreviations('github:author', { 'owner/repo': 'r' });
    store.close();
    {
      using db = new DatabaseSync(file);
      db.prepare("UPDATE settings SET value = '[1]' WHERE name = 'abbreviations'").run();
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reopened = openSqliteStore(file);
    await expect(reopened.readUserState('github:author')).resolves.toMatchObject({ abbreviations: {} });
    reopened.close();
    expect(warn).toHaveBeenCalledOnce();
  });
});

// region | Helpers
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
