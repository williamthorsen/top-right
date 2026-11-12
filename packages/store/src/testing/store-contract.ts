import type { CollectionSettings, ScoreLabelMapping, StatusOverride, WorkTypeMapping } from '@top-right/model';
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
        scoreLabelMapping: undefined,
        abbreviations: {},
        collections: { collections: [], defaultCollectionId: undefined },
      });
    });

    it('returns and reads back the scores that it writes, with their provenance', async () => {
      const written = await opened.store.writeScores(
        USER,
        ITEM,
        { urgency: 'high', progress: 0.35 },
        'author',
        EARLIER,
      );

      const expected = {
        urgency: { score: 'high', by: 'author', at: EARLIER },
        progress: { score: 0.35, by: 'author', at: EARLIER },
      };
      expect(written).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores).toEqual({ [ITEM]: expected });
    });

    it('leaves the fields that a write omits, and their provenance, unchanged', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 'medium', value: 'nice-to-have' }, 'author', EARLIER);
      const written = await opened.store.writeScores(USER, ITEM, { value: 'must-have' }, 'author', LATER);

      expect(written).toEqual({
        urgency: { score: 'medium', by: 'author', at: EARLIER },
        value: { score: 'must-have', by: 'author', at: LATER },
      });
    });

    it('records the score that the author held when an agent changes it', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 'medium' }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { urgency: 'high' }, 'agent', LATER);

      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual({
        urgency: { score: 'high', by: 'agent', at: LATER, previous: 'medium' },
      });
    });

    it('turns every agent score into the author’s when the author writes any of the item’s scores', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 'medium' }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { urgency: 'high', effort: 5 }, 'agent', EARLIER);
      const written = await opened.store.writeScores(USER, ITEM, { value: 'nice-to-have' }, 'author', LATER);

      const expected = {
        urgency: { score: 'high', by: 'author', at: LATER },
        value: { score: 'nice-to-have', by: 'author', at: LATER },
        effort: { score: 5, by: 'author', at: LATER },
      };
      expect(written).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual(expected);
    });

    it('keeps an item’s agent scores as the author’s', async () => {
      await opened.store.writeScores(USER, ITEM, { value: 'nice-to-have' }, 'author', EARLIER);
      await opened.store.writeScores(USER, ITEM, { value: 'must-have', urgency: 'medium' }, 'agent', EARLIER);
      const kept = await opened.store.keepScores(USER, ITEM, LATER);

      const expected = {
        urgency: { score: 'medium', by: 'author', at: LATER },
        value: { score: 'must-have', by: 'author', at: LATER },
      };
      expect(kept).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores[ITEM]).toEqual(expected);
    });

    it('keeps nothing for an item without scores', async () => {
      await expect(opened.store.keepScores(USER, ITEM, LATER)).resolves.toEqual({});
      expect((await opened.store.readUserState(USER)).scores).toEqual({});
    });

    it('clears the named fields of an item and keeps the rest', async () => {
      await opened.store.writeScores(
        USER,
        ITEM,
        { urgency: 'high', value: 'must-have', progress: 0.5 },
        'author',
        EARLIER,
      );
      await opened.store.writeScores(USER, OTHER_ITEM, { urgency: 'low' }, 'author', EARLIER);
      const cleared = await opened.store.clearScores(USER, ITEM, ['urgency', 'value', 'effort']);

      const expected = { progress: { score: 0.5, by: 'author', at: EARLIER } };
      expect(cleared).toEqual(expected);
      expect((await opened.store.readUserState(USER)).scores).toEqual({
        [ITEM]: expected,
        [OTHER_ITEM]: { urgency: { score: 'low', by: 'author', at: EARLIER } },
      });
    });

    it('when every field of an item is cleared, reads the item as unscored', async () => {
      await opened.store.writeScores(USER, ITEM, { urgency: 'high' }, 'agent', EARLIER);

      await expect(opened.store.clearScores(USER, ITEM, ['urgency'])).resolves.toEqual({});
      expect((await opened.store.readUserState(USER)).scores).toEqual({});
    });

    it('keeps users and items apart', async () => {
      await opened.store.writeScores(USER, ITEM, { effort: 3 }, 'author', EARLIER);
      await opened.store.writeScores(USER, OTHER_ITEM, { effort: 8 }, 'author', EARLIER);
      await opened.store.writeScores(OTHER_USER, ITEM, { effort: 13 }, 'author', EARLIER);

      const { scores } = await opened.store.readUserState(USER);
      expect(scores[ITEM]?.effort?.score).toBe(3);
      expect(scores[OTHER_ITEM]?.effort?.score).toBe(8);
      expect((await opened.store.readUserState(OTHER_USER)).scores[ITEM]?.effort?.score).toBe(13);
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

    it('sets a score-label mapping per user and restores the default', async () => {
      const mapping: ScoreLabelMapping = {
        urgency: { critical: ['p0'], high: ['priority:high'], low: [], medium: [] },
        value: { 'must-have': ['value:must-have'], 'nice-to-have': [], questionable: [], 'should-have': [] },
        effort: { 1: ['xs'], 2: [], 3: ['effort:3'], 5: [], 8: [], 13: ['xl', 'epic'] },
      };
      await opened.store.writeScoreLabelMapping(USER, mapping);
      expect((await opened.store.readUserState(USER)).scoreLabelMapping).toEqual(mapping);
      expect((await opened.store.readUserState(OTHER_USER)).scoreLabelMapping).toBeUndefined();

      await opened.store.writeScoreLabelMapping(USER, undefined);
      expect((await opened.store.readUserState(USER)).scoreLabelMapping).toBeUndefined();
    });

    it('tells a saved score-label mapping whose entries are all empty from no saved mapping', async () => {
      const empty: ScoreLabelMapping = {
        urgency: { critical: [], high: [], low: [], medium: [] },
        value: { 'must-have': [], 'nice-to-have': [], questionable: [], 'should-have': [] },
        effort: { 1: [], 2: [], 3: [], 5: [], 8: [], 13: [] },
      };
      await opened.store.writeScoreLabelMapping(USER, empty);

      expect((await opened.store.readUserState(USER)).scoreLabelMapping).toEqual(empty);
    });

    it('replaces the abbreviations per user', async () => {
      await opened.store.writeAbbreviations(USER, { 'owner/repo': 'r', 'owner/other': 'o' });
      await opened.store.writeAbbreviations(USER, { 'owner/repo': 'rp' });

      expect((await opened.store.readUserState(USER)).abbreviations).toEqual({ 'owner/repo': 'rp' });
      expect((await opened.store.readUserState(OTHER_USER)).abbreviations).toEqual({});
    });

    it('reads back the collections and the default that it writes, per user', async () => {
      const settings: CollectionSettings = {
        collections: [
          { id: 'c1', name: 'Core', repos: ['owner/repo', 'owner/other'] },
          { id: 'c2', name: 'Tools', repos: ['owner/tool'] },
        ],
        defaultCollectionId: 'c2',
      };
      await opened.store.writeCollections(USER, settings);

      expect((await opened.store.readUserState(USER)).collections).toEqual(settings);
      expect((await opened.store.readUserState(OTHER_USER)).collections).toEqual({
        collections: [],
        defaultCollectionId: undefined,
      });
    });

    it('replaces the collections, including clearing the default', async () => {
      await opened.store.writeCollections(USER, {
        collections: [{ id: 'c1', name: 'Core', repos: ['owner/repo'] }],
        defaultCollectionId: 'c1',
      });
      const replacement: CollectionSettings = {
        collections: [{ id: 'c2', name: 'Tools', repos: ['owner/tool'] }],
        defaultCollectionId: undefined,
      };
      await opened.store.writeCollections(USER, replacement);

      expect((await opened.store.readUserState(USER)).collections).toEqual(replacement);
    });

    it('reads the empty settings after an empty list without a default is written', async () => {
      await opened.store.writeCollections(USER, {
        collections: [{ id: 'c1', name: 'Core', repos: ['owner/repo'] }],
        defaultCollectionId: 'c1',
      });
      await opened.store.writeCollections(USER, { collections: [], defaultCollectionId: undefined });

      expect((await opened.store.readUserState(USER)).collections).toEqual({
        collections: [],
        defaultCollectionId: undefined,
      });
    });
  });
}
