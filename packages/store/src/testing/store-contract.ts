import type { StatusOverride, WorkTypeMapping } from '@top-right/model';
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
        workTypeMapping: undefined,
        abbreviations: {},
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
      await opened.store.writeScores(USER, ITEM, { urgency: 2, impact: 3 }, 'author', EARLIER);
      const written = await opened.store.writeScores(USER, ITEM, { impact: 5 }, 'author', LATER);

      expect(written).toEqual({
        urgency: { value: 2, by: 'author', at: EARLIER },
        impact: { value: 5, by: 'author', at: LATER },
      });
    });

    it('records the value that the author held when an agent changes it', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 2 }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { urgency: 4 }, 'agent', LATER);

      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual({
        urgency: { value: 4, by: 'agent', at: LATER, previous: 2 },
      });
    });

    it('turns every agent score into the author’s when the author writes any of the item’s scores', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 2 }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { urgency: 4, effort: 5 }, 'agent', EARLIER);
      const written = await opened.store.writeScores(USER, ITEM, { impact: 3 }, 'author', LATER);

      const expected = {
        urgency: { value: 4, by: 'author', at: LATER },
        impact: { value: 3, by: 'author', at: LATER },
        effort: { value: 5, by: 'author', at: LATER },
      };
      expect(written).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual(expected);
    });

    it('keeps an item’s agent scores as the author’s', async () => {
      await opened.store.writeScores(USER, ITEM, { impact: 3 }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { impact: 5, urgency: 2 }, 'agent', EARLIER);
      const kept = await opened.store.keepScores(USER, ITEM, LATER);

      const expected = {
        urgency: { value: 2, by: 'author', at: LATER },
        impact: { value: 5, by: 'author', at: LATER },
      };
      expect(kept).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual(expected);
    });

    it('keeps nothing for an item without scores', async () => {
      await expect(opened.store.keepScores(USER, ITEM, LATER)).resolves.toEqual({});
      expect((await opened.store.readUserState(USER)).scores).toEqual({});
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

    it('sets a work-type mapping per user and restores the default', async () => {
      const mapping: WorkTypeMapping = { bug: ['defect'], feature: ['feat'], ops: [], task: ['chore'] };
      await opened.store.writeWorkTypeMapping(USER, mapping);
      expect((await opened.store.readUserState(USER)).workTypeMapping).toEqual(mapping);
      expect((await opened.store.readUserState(OTHER_USER)).workTypeMapping).toBeUndefined();

      await opened.store.writeWorkTypeMapping(USER, undefined);
      expect((await opened.store.readUserState(USER)).workTypeMapping).toBeUndefined();
    });

    it('tells a saved mapping whose types are all empty from no saved mapping', async () => {
      const empty: WorkTypeMapping = { bug: [], feature: [], ops: [], task: [] };
      await opened.store.writeWorkTypeMapping(USER, empty);

      expect((await opened.store.readUserState(USER)).workTypeMapping).toEqual(empty);
    });

    it('replaces the abbreviations per user', async () => {
      await opened.store.writeAbbreviations(USER, { 'owner/repo': 'r', 'owner/other': 'o' });
      await opened.store.writeAbbreviations(USER, { 'owner/repo': 'rp' });

      expect((await opened.store.readUserState(USER)).abbreviations).toEqual({ 'owner/repo': 'rp' });
      expect((await opened.store.readUserState(OTHER_USER)).abbreviations).toEqual({});
    });
  });
}
