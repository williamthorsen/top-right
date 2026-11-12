import type { WorkItem } from '@top-right/model';
import { describe, expect, it, vi } from 'vitest';

import { createItemsCache } from '../items-cache.ts';

const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 11,
  title: 'Plot the issues',
  url: 'https://github.com/williamthorsen/top-right/issues/11',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: [],
  relations: [],
};
const RENAMED: WorkItem = { ...ITEM, title: 'Plot every issue' };
const REPO = ITEM.repo;
const OTHER_REPO = 'williamthorsen/toolbelt';
const OTHER_ITEM: WorkItem = { ...ITEM, repo: OTHER_REPO, url: 'https://github.com/williamthorsen/toolbelt/issues/11' };
const START = new Date('2026-11-10T12:00:00.000Z');

describe(createItemsCache, () => {
  it('waits for the first read and serves its issues with when it started', async () => {
    const cache = createItemsCache({ loadRepo: () => Promise.resolve([ITEM]), now: () => START });

    expect(await cache.get([REPO])).toStrictEqual({
      items: [ITEM],
      reads: { [REPO]: { readAt: START, isStale: false } },
    });
  });

  it('serves a second load from memory', async () => {
    const loadRepo = vi.fn(() => Promise.resolve([ITEM]));
    const cache = createItemsCache({ loadRepo, now: () => START });

    await cache.get([REPO]);
    await cache.get([REPO]);

    expect(loadRepo).toHaveBeenCalledTimes(1);
  });

  it('reports the issues as stale once they are older than the maximum age', async () => {
    const clock = createClock();
    const cache = createItemsCache({ loadRepo: () => Promise.resolve([ITEM]), maxAgeMs: 1000, now: clock.now });

    await cache.get([REPO]);
    clock.advance(1000);
    expect((await cache.get([REPO])).reads[REPO]?.isStale).toBe(false);
    clock.advance(1);
    expect((await cache.get([REPO])).reads[REPO]?.isStale).toBe(true);
  });

  it('shares one read among concurrent loads and refreshes', async () => {
    const loadRepo = vi.fn(() => Promise.resolve([ITEM]));
    const cache = createItemsCache({ loadRepo, now: () => START });

    await Promise.all([cache.get([REPO]), cache.refresh([REPO]), cache.refresh([REPO])]);

    expect(loadRepo).toHaveBeenCalledTimes(1);
  });

  it('replaces the issues and their read time on a refresh', async () => {
    const clock = createClock();
    const loadRepo = vi
      .fn<(repo: string) => Promise<WorkItem[]>>()
      .mockResolvedValueOnce([ITEM])
      .mockResolvedValueOnce([RENAMED]);
    const cache = createItemsCache({ loadRepo, now: clock.now });

    await cache.get([REPO]);
    clock.advance(5000);
    const refreshed = await cache.refresh([REPO]);

    expect(refreshed).toStrictEqual({ items: [RENAMED], reads: { [REPO]: { readAt: clock.now(), isStale: false } } });
    expect((await cache.get([REPO])).items).toStrictEqual([RENAMED]);
  });

  it('if a refresh fails, keeps the last issues and their read time', async () => {
    const clock = createClock();
    const loadRepo = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockResolvedValueOnce([ITEM])
      .mockRejectedValueOnce(new Error('GitHub did not respond.'));
    const cache = createItemsCache({ loadRepo, now: clock.now });

    await cache.get([REPO]);
    clock.advance(5000);

    await expect(cache.refresh([REPO])).rejects.toThrow('GitHub did not respond.');
    expect(await cache.get([REPO])).toMatchObject({ items: [ITEM], reads: { [REPO]: { readAt: START } } });
  });

  it('if the first read fails, reads again on the next load', async () => {
    const loadRepo = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockRejectedValueOnce(new Error('GitHub did not respond.'))
      .mockResolvedValueOnce([ITEM]);
    const cache = createItemsCache({ loadRepo, now: () => START });

    await expect(cache.get([REPO])).rejects.toThrow('GitHub did not respond.');
    expect((await cache.get([REPO])).items).toStrictEqual([ITEM]);
    expect(loadRepo).toHaveBeenCalledTimes(2);
  });

  it('if the loader throws before returning a promise, reads again on the next load', async () => {
    const loadRepo = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockImplementationOnce(() => {
        throw new Error('The config could not be read.');
      })
      .mockResolvedValueOnce([ITEM]);
    const cache = createItemsCache({ loadRepo, now: () => START });

    await expect(cache.refresh([REPO])).rejects.toThrow('The config could not be read.');
    expect((await cache.get([REPO])).items).toStrictEqual([ITEM]);
  });

  describe('with several repositories', () => {
    it('reads only the repositories that a load names', async () => {
      const loadRepo = vi.fn((repo: string) => Promise.resolve([repo === REPO ? ITEM : OTHER_ITEM]));
      const cache = createItemsCache({ loadRepo, now: () => START });

      expect((await cache.get([OTHER_REPO])).items).toStrictEqual([OTHER_ITEM]);
      expect(loadRepo.mock.calls).toStrictEqual([[OTHER_REPO]]);
    });

    it('reads only the repositories that have not been read, and serves the rest from memory', async () => {
      const loadRepo = vi.fn((repo: string) => Promise.resolve([repo === REPO ? ITEM : OTHER_ITEM]));
      const cache = createItemsCache({ loadRepo, now: () => START });
      await cache.get([REPO]);

      expect((await cache.get([REPO, OTHER_REPO])).items).toStrictEqual([ITEM, OTHER_ITEM]);
      expect(loadRepo.mock.calls).toStrictEqual([[REPO], [OTHER_REPO]]);
    });

    it('shares the read of a repository already in progress with a load that also names another', async () => {
      const read = Promise.withResolvers<WorkItem[]>();
      const loadRepo = vi.fn((repo: string) => (repo === REPO ? read.promise : Promise.resolve([OTHER_ITEM])));
      const cache = createItemsCache({ loadRepo, now: () => START });

      const refreshing = cache.refresh([REPO]);
      const loading = cache.get([REPO, OTHER_REPO]);
      read.resolve([ITEM]);

      expect((await loading).items).toStrictEqual([ITEM, OTHER_ITEM]);
      await refreshing;
      expect(loadRepo.mock.calls).toStrictEqual([[REPO], [OTHER_REPO]]);
    });

    it('reports each repository with its own read time', async () => {
      const clock = createClock();
      const cache = createItemsCache({
        loadRepo: (repo) => Promise.resolve([repo === REPO ? ITEM : OTHER_ITEM]),
        maxAgeMs: 1000,
        now: clock.now,
      });
      await cache.get([REPO]);
      clock.advance(5000);

      const { reads } = await cache.get([REPO, OTHER_REPO]);

      expect(reads).toStrictEqual({
        [REPO]: { readAt: START, isStale: true },
        [OTHER_REPO]: { readAt: clock.now(), isStale: false },
      });
    });

    it("if one repository's read fails, rejects the load and keeps the other repository's read", async () => {
      const loadRepo = vi.fn((repo: string) =>
        repo === REPO ? Promise.resolve([ITEM]) : Promise.reject(new Error('GitHub did not respond.')),
      );
      const cache = createItemsCache({ loadRepo, now: () => START });

      await expect(cache.get([REPO, OTHER_REPO])).rejects.toThrow('GitHub did not respond.');
      expect((await cache.get([REPO])).items).toStrictEqual([ITEM]);
      expect(loadRepo).toHaveBeenCalledTimes(2);
    });

    it("patches only the item's repository while another repository is being read", async () => {
      const read = Promise.withResolvers<WorkItem[]>();
      const loadRepo = vi.fn((repo: string) => (repo === REPO ? Promise.resolve([ITEM]) : read.promise));
      const cache = createItemsCache({ loadRepo, now: () => START });
      await cache.get([REPO]);

      const refreshing = cache.refresh([OTHER_REPO]);
      cache.patchItem(`${REPO}#11`, { labels: ['urgency:high'] });
      read.resolve([OTHER_ITEM]);

      expect((await refreshing).items).toStrictEqual([OTHER_ITEM]);
      expect((await cache.get([REPO])).items[0]?.labels).toStrictEqual(['urgency:high']);
    });
  });

  describe('patchItem', () => {
    const KEY = 'williamthorsen/top-right#11';

    it("replaces the item's labels in the last read", async () => {
      const cache = createItemsCache({ loadRepo: () => Promise.resolve([ITEM]), now: () => START });
      await cache.get([REPO]);

      cache.patchItem(KEY, { labels: ['urgency:high'] });

      expect((await cache.get([REPO])).items[0]?.labels).toStrictEqual(['urgency:high']);
    });

    it('when a read is in progress, applies the labels to the issues that it returns', async () => {
      const read = Promise.withResolvers<WorkItem[]>();
      const cache = createItemsCache({ loadRepo: () => read.promise, now: () => START });

      const refreshing = cache.refresh([REPO]);
      cache.patchItem(KEY, { labels: ['urgency:high'] });
      read.resolve([ITEM]);

      expect((await refreshing).items[0]?.labels).toStrictEqual(['urgency:high']);
      expect((await cache.get([REPO])).items[0]?.labels).toStrictEqual(['urgency:high']);
    });

    it('lets a read that starts after the write take its labels from the source', async () => {
      const loadRepo = vi
        .fn<() => Promise<WorkItem[]>>()
        .mockResolvedValueOnce([ITEM])
        .mockResolvedValueOnce([{ ...ITEM, labels: ['urgency:low'] }]);
      const cache = createItemsCache({ loadRepo, now: () => START });
      await cache.get([REPO]);

      cache.patchItem(KEY, { labels: ['urgency:high'] });

      expect((await cache.refresh([REPO])).items[0]?.labels).toStrictEqual(['urgency:low']);
    });

    it('replaces only the fields that the patch names', async () => {
      const labelled: WorkItem = { ...ITEM, labels: ['status:in-progress'], sourceStatus: 'in-progress' };
      const cache = createItemsCache({ loadRepo: () => Promise.resolve([labelled]), now: () => START });
      await cache.get([REPO]);

      cache.patchItem(KEY, { labels: ['status:in-progress', 'urgency:high'] });

      expect((await cache.get([REPO])).items[0]).toMatchObject({
        labels: ['status:in-progress', 'urgency:high'],
        sourceStatus: 'in-progress',
      });
    });

    it('when a read is in progress, applies every patch made during it', async () => {
      const read = Promise.withResolvers<WorkItem[]>();
      const cache = createItemsCache({ loadRepo: () => read.promise, now: () => START });

      const refreshing = cache.refresh([REPO]);
      cache.patchItem(KEY, { labels: ['status:in-progress'], sourceStatus: 'in-progress' });
      cache.patchItem(KEY, { labels: ['status:in-progress', 'urgency:high'] });
      read.resolve([{ ...ITEM, sourceStatus: 'to-do' }]);

      expect((await refreshing).items[0]).toMatchObject({
        labels: ['status:in-progress', 'urgency:high'],
        sourceStatus: 'in-progress',
      });
    });
  });
});

// region | Helpers
/** Returns a clock that starts at `START` and moves only when advanced. */
function createClock(): { now: () => Date; advance: (ms: number) => void } {
  let time = START.getTime();
  return {
    now: () => new Date(time),
    advance: (ms) => {
      time += ms;
    },
  };
}
// endregion | Helpers
