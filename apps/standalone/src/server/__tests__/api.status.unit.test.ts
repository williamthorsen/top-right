import type { StatusStrategy } from '@top-right/adapter-github';
import type { ItemPatch, OpenStatus, StatusOverride } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { closeServers, EARLIER, ITEM, ITEM_KEY, NOW, post, startServer } from '../test-utils/api-server.ts';

const REF = { repo: ITEM.repo, number: ITEM.number };
const LEGACY: StatusOverride = { status: 'in-progress', sourceState: 'open', at: EARLIER };
const WRITES: Array<{ status: OpenStatus; patch: ItemPatch }> = [
  { status: 'in-progress', patch: { labels: ['feature', 'status:in-progress'], sourceStatus: 'in-progress' } },
  { status: 'to-do', patch: { labels: ['feature'], sourceStatus: 'to-do' } },
];

afterEach(closeServers);

describe('POST /api/status on a host whose repository has a status strategy', () => {
  it.each(WRITES)(
    'writes $status at the source, deletes the stored override, and serves the new labels',
    async ({ status, patch }) => {
      const store = createMemoryStore({ overrides: { [ITEM_KEY]: LEGACY } });
      const strategy = createStrategy(() => Promise.resolve(patch));
      const baseUrl = await startServer({ store, statusStrategyFor: () => strategy });
      await fetch(`${baseUrl}/api/items`);

      const response = await post(`${baseUrl}/api/status`, { itemKey: ITEM_KEY, status, sourceState: 'open' });

      expect(strategy.write).toHaveBeenCalledWith(REF, status);
      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, override: null, ...patch });
      expect(store.state.overrides).toStrictEqual({});
      const items: unknown = await (await fetch(`${baseUrl}/api/items`)).json();
      expect(items).toMatchObject({ items: [patch], overrides: {} });
    },
  );

  it('if the source refuses the write, answers 502 and leaves the override and the item as they were', async () => {
    const store = createMemoryStore({ overrides: { [ITEM_KEY]: LEGACY } });
    const strategy = createStrategy(() => Promise.reject(new Error('has no label "status:in-progress"')));
    const baseUrl = await startServer({ store, statusStrategyFor: () => strategy });
    await fetch(`${baseUrl}/api/items`);

    const response = await post(`${baseUrl}/api/status`, { itemKey: ITEM_KEY, status: 'to-do', sourceState: 'open' });

    expect(response.status).toBe(502);
    expect(await response.json()).toStrictEqual({ error: expect.stringContaining('has no label') });
    expect(store.state.overrides).toStrictEqual({ [ITEM_KEY]: LEGACY });
    const items: unknown = await (await fetch(`${baseUrl}/api/items`)).json();
    expect(items).toMatchObject({ items: [{ labels: ITEM.labels }] });
    expect(items).not.toHaveProperty('items.0.sourceStatus');
  });

  it('if the store fails after the write, answers 500 with the new labels and source status', async () => {
    const store = createMemoryStore({ overrides: { [ITEM_KEY]: LEGACY } });
    store.writeStatusOverride = () => Promise.reject(new Error('disk full'));
    const patch: ItemPatch = { labels: ['feature'], sourceStatus: 'to-do' };
    const baseUrl = await startServer({ store, statusStrategyFor: () => createStrategy(() => Promise.resolve(patch)) });

    const response = await post(`${baseUrl}/api/status`, { itemKey: ITEM_KEY, status: 'to-do', sourceState: 'open' });

    expect(response.status).toBe(500);
    expect(await response.json()).toStrictEqual({
      error: expect.stringMatching(/status changed at GitHub.*disk full/),
      ...patch,
    });
  });

  it('refuses a status for an item that is closed at its source, without writing it', async () => {
    const strategy = createStrategy(() => Promise.resolve({}));
    const baseUrl = await startServer({ statusStrategyFor: () => strategy });

    const response = await post(`${baseUrl}/api/status`, {
      itemKey: ITEM_KEY,
      status: 'in-progress',
      sourceState: 'closed',
    });

    expect(response.status).toBe(400);
    expect(strategy.write).not.toHaveBeenCalled();
  });

  it.each([
    { case: 'a repository without a strategy', itemKey: 'owner/untracked#3' },
    { case: 'a key without a repository', itemKey: 'task:write-the-docs' },
  ])('for $case, keeps the status as an override', async ({ itemKey }) => {
    const store = createMemoryStore();
    const strategy = createStrategy(() => Promise.resolve({}));
    const baseUrl = await startServer({
      store,
      statusStrategyFor: (repo) => (repo === ITEM.repo ? strategy : undefined),
    });

    await post(`${baseUrl}/api/status`, { itemKey, status: 'in-progress', sourceState: 'open' });

    expect(strategy.write).not.toHaveBeenCalled();
    expect(store.state.overrides).toStrictEqual({
      [itemKey]: { status: 'in-progress', sourceState: 'open', at: NOW.toISOString() },
    });
  });
});

// region | Helpers
/** Returns a status strategy whose `write` records its calls and settles as `write` does. */
function createStrategy(write: () => Promise<ItemPatch>) {
  return {
    issueFields: '',
    read: vi.fn<StatusStrategy['read']>(() => 'to-do'),
    write: vi.fn<StatusStrategy['write']>(write),
  };
}
// endregion | Helpers
