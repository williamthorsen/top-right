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
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
  });
});
