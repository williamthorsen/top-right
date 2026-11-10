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
const START = new Date('2026-11-10T12:00:00.000Z');

describe(createItemsCache, () => {
  it('waits for the first read and serves its issues with when it started', async () => {
    const cache = createItemsCache({ load: () => Promise.resolve([ITEM]), now: () => START });

    expect(await cache.get()).toStrictEqual({ items: [ITEM], readAt: START, isStale: false });
  });

  it('serves a second load from memory', async () => {
    const load = vi.fn(() => Promise.resolve([ITEM]));
    const cache = createItemsCache({ load, now: () => START });

    await cache.get();
    await cache.get();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports the issues as stale once they are older than the maximum age', async () => {
    const clock = createClock();
    const cache = createItemsCache({ load: () => Promise.resolve([ITEM]), maxAgeMs: 1000, now: clock.now });

    await cache.get();
    clock.advance(1000);
    expect((await cache.get()).isStale).toBe(false);
    clock.advance(1);
    expect((await cache.get()).isStale).toBe(true);
  });

  it('shares one read among concurrent loads and refreshes', async () => {
    const load = vi.fn(() => Promise.resolve([ITEM]));
    const cache = createItemsCache({ load, now: () => START });

    await Promise.all([cache.get(), cache.refresh(), cache.refresh()]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('replaces the issues and their read time on a refresh', async () => {
    const clock = createClock();
    const load = vi.fn<() => Promise<WorkItem[]>>().mockResolvedValueOnce([ITEM]).mockResolvedValueOnce([RENAMED]);
    const cache = createItemsCache({ load, now: clock.now });

    await cache.get();
    clock.advance(5000);
    const refreshed = await cache.refresh();

    expect(refreshed).toStrictEqual({ items: [RENAMED], readAt: clock.now() });
    expect((await cache.get()).items).toStrictEqual([RENAMED]);
  });

  it('if a refresh fails, keeps the last issues and their read time', async () => {
    const clock = createClock();
    const load = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockResolvedValueOnce([ITEM])
      .mockRejectedValueOnce(new Error('GitHub did not respond.'));
    const cache = createItemsCache({ load, now: clock.now });

    await cache.get();
    clock.advance(5000);

    await expect(cache.refresh()).rejects.toThrow('GitHub did not respond.');
    expect(await cache.get()).toMatchObject({ items: [ITEM], readAt: START });
  });

  it('if the first read fails, reads again on the next load', async () => {
    const load = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockRejectedValueOnce(new Error('GitHub did not respond.'))
      .mockResolvedValueOnce([ITEM]);
    const cache = createItemsCache({ load, now: () => START });

    await expect(cache.get()).rejects.toThrow('GitHub did not respond.');
    expect((await cache.get()).items).toStrictEqual([ITEM]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('if the loader throws before returning a promise, reads again on the next load', async () => {
    const load = vi
      .fn<() => Promise<WorkItem[]>>()
      .mockImplementationOnce(() => {
        throw new Error('The config could not be read.');
      })
      .mockResolvedValueOnce([ITEM]);
    const cache = createItemsCache({ load, now: () => START });

    await expect(cache.refresh()).rejects.toThrow('The config could not be read.');
    expect((await cache.get()).items).toStrictEqual([ITEM]);
  });

  describe('setLabels', () => {
    const KEY = 'williamthorsen/top-right#11';

    it("replaces the item's labels in the last read", async () => {
      const cache = createItemsCache({ load: () => Promise.resolve([ITEM]), now: () => START });
      await cache.get();

      cache.setLabels(KEY, ['urgency:high']);

      expect((await cache.get()).items[0]?.labels).toStrictEqual(['urgency:high']);
    });

    it('when a read is in progress, applies the labels to the issues that it returns', async () => {
      const read = Promise.withResolvers<WorkItem[]>();
      const cache = createItemsCache({ load: () => read.promise, now: () => START });

      const refreshing = cache.refresh();
      cache.setLabels(KEY, ['urgency:high']);
      read.resolve([ITEM]);

      expect((await refreshing).items[0]?.labels).toStrictEqual(['urgency:high']);
      expect((await cache.get()).items[0]?.labels).toStrictEqual(['urgency:high']);
    });

    it('lets a read that starts after the write take its labels from the source', async () => {
      const load = vi
        .fn<() => Promise<WorkItem[]>>()
        .mockResolvedValueOnce([ITEM])
        .mockResolvedValueOnce([{ ...ITEM, labels: ['urgency:low'] }]);
      const cache = createItemsCache({ load, now: () => START });
      await cache.get();

      cache.setLabels(KEY, ['urgency:high']);

      expect((await cache.refresh()).items[0]?.labels).toStrictEqual(['urgency:low']);
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
