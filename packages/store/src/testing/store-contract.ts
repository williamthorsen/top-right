import type { StatusOverride } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Store } from '#src/store.ts';

/** A store opened for one test, with the function that releases it. */
export interface OpenedStore {
  store: Store;
  close: () => Promise<void> | void;
}

const USER = 'github:author';
const OTHER_USER = 'github:other';
const ITEM = 'owner/repo#1';
const OTHER_ITEM = 'owner/repo#2';
const EARLIER = '2026-11-01T09:00:00.000Z';
const LATER = '2026-11-02T09:00:00.000Z';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: EARLIER };

/** Registers the tests that every `Store` implementation passes, each against a store from `openStore`. */
export function describeStoreContract(name: string, openStore: () => Promise<OpenedStore> | OpenedStore): void {
  describe(`${name} honours the Store contract`, () => {
    let opened: OpenedStore;

    beforeEach(async () => {
      opened = await openStore();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('reads an empty state for a user without any records', async () => {
      await expect(opened.store.readUserState(USER)).resolves.toEqual({
        scores: {},
        overrides: {},
        lastVisitAt: undefined,
      });
    });

    it('returns and reads back the scores that it writes, with their provenance', async () => {
      const written = await opened.store.writeScores(USER, ITEM, { urgency: 4, progress: 0.35 }, 'author', EARLIER);

      const expected = {
        urgency: { value: 4, by: 'author', at: EARLIER },
        progress: { value: 0.35, by: 'author', at: EARLIER },
      };
      expect(written).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores).toEqual({ [ITEM]: expected });
    });

    it('leaves the fields that a write omits, and their provenance, unchanged', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 2, impact: 3 }, 'agent', EARLIER);
      const written = await opened.store.writeScores(USER, ITEM, { impact: 5 }, 'author', LATER);

      expect(written).toEqual({
        urgency: { value: 2, by: 'agent', at: EARLIER },
        impact: { value: 5, by: 'author', at: LATER },
      });
    });

    it('keeps users and items apart', async () => {
      await opened.store.writeScores(USER, ITEM, { effort: 3 }, 'author', EARLIER);
      await opened.store.writeScores(USER, OTHER_ITEM, { effort: 8 }, 'author', EARLIER);
      await opened.store.writeScores(OTHER_USER, ITEM, { effort: 13 }, 'author', EARLIER);

      const { scores } = await opened.store.readUserState(USER);
      expect(scores[ITEM]?.effort?.value).toBe(3);
      expect(scores[OTHER_ITEM]?.effort?.value).toBe(8);
      expect((await opened.store.readUserState(OTHER_USER)).scores[ITEM]?.effort?.value).toBe(13);
    });

    it('sets, replaces, and clears a status override', async () => {
      await opened.store.writeStatusOverride(USER, ITEM, IN_PROGRESS);
      expect((await opened.store.readUserState(USER)).overrides).toEqual({ [ITEM]: IN_PROGRESS });

      const toDo: StatusOverride = { status: 'to-do', sourceState: 'open', at: LATER };
      await opened.store.writeStatusOverride(USER, ITEM, toDo);
      expect((await opened.store.readUserState(USER)).overrides).toEqual({ [ITEM]: toDo });

      await opened.store.writeStatusOverride(USER, ITEM, undefined);
      expect((await opened.store.readUserState(USER)).overrides).toEqual({});
    });

    it('keeps the latest end of a visit', async () => {
      await opened.store.writeLastVisit(USER, EARLIER);
      await opened.store.writeLastVisit(USER, LATER);

      expect((await opened.store.readUserState(USER)).lastVisitAt).toBe(LATER);
      expect((await opened.store.readUserState(OTHER_USER)).lastVisitAt).toBeUndefined();
    });
  });
}
