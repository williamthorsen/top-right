import type { StatusOverride, WorkItem } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { createApiHandler } from '../api.ts';
import { closeServers, EARLIER, ITEM, ITEM_KEY, NOW, post, startServer } from '../test-utils/api-server.ts';

const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: EARLIER };
const OTHER_REPO = 'williamthorsen/toolbelt';
const OTHER_ITEM: WorkItem = { ...ITEM, repo: OTHER_REPO, url: 'https://github.com/williamthorsen/toolbelt/issues/11' };
const OTHER_KEY = `${OTHER_REPO}#11`;
const FRESH_READ = { readAt: NOW.toISOString(), isStale: false };
const PRODUCT = { collections: [{ id: 'c1', name: 'Product', repos: [ITEM.repo] }], defaultCollectionId: 'c1' };

afterEach(closeServers);

describe(createApiHandler, () => {
  describe('GET /api/items with repositories outside the default collection', () => {
    it("reads only the default collection's repositories and the selected item's repository", async () => {
      const third = 'williamthorsen/codeassembly';
      const loadItems = vi.fn(() => Promise.resolve([ITEM, OTHER_ITEM, { ...ITEM, repo: third }]));
      const store = createMemoryStore({
        collections: PRODUCT,
      });
      const baseUrl = await startServer({ loadItems, store, repos: [ITEM.repo, OTHER_REPO, third] });

      const body: unknown = await (await fetch(`${baseUrl}/api/items?item=${encodeURIComponent(OTHER_KEY)}`)).json();

      expect(body).toMatchObject({
        items: [ITEM, OTHER_ITEM],
        reads: { [ITEM.repo]: FRESH_READ, [OTHER_REPO]: FRESH_READ },
      });
      expect(loadItems).toHaveBeenCalledTimes(2);
    });

    it('keeps and returns the override of an item in a configured repository outside the read', async () => {
      const store = createMemoryStore({
        collections: PRODUCT,
        overrides: { [OTHER_KEY]: IN_PROGRESS },
      });
      const baseUrl = await startServer({ store, repos: [ITEM.repo, OTHER_REPO] });

      const body: unknown = await (await fetch(`${baseUrl}/api/items`)).json();

      expect(body).toMatchObject({ overrides: { [OTHER_KEY]: IN_PROGRESS } });
      expect(store.state.overrides).toStrictEqual({ [OTHER_KEY]: IN_PROGRESS });
    });
  });

  describe('POST /api/items/read', () => {
    it('answers with the named repositories, reading only those that the host has not read', async () => {
      const loadItems = vi.fn(() => Promise.resolve([ITEM, OTHER_ITEM]));
      const baseUrl = await startServer({ loadItems, repos: [ITEM.repo, OTHER_REPO] });
      await post(`${baseUrl}/api/items/read`, { repos: [ITEM.repo] });

      const response = await post(`${baseUrl}/api/items/read`, { repos: [ITEM.repo, OTHER_REPO] });

      expect(await response.json()).toStrictEqual({
        items: [ITEM, OTHER_ITEM],
        reads: { [ITEM.repo]: FRESH_READ, [OTHER_REPO]: FRESH_READ },
      });
      expect(loadItems).toHaveBeenCalledTimes(2);
    });

    it('refuses a repository that the config does not list', async () => {
      const baseUrl = await startServer({});

      const response = await post(`${baseUrl}/api/items/read`, { repos: ['williamthorsen/elsewhere'] });

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({
        error: 'williamthorsen/elsewhere is not a configured repository.',
      });
    });
  });

  describe('POST /api/items/refresh with named repositories', () => {
    it('reads only the named repositories, and keeps the override of an item outside them', async () => {
      const loadItems = vi.fn(() => Promise.resolve([ITEM]));
      const store = createMemoryStore({ overrides: { [ITEM_KEY]: IN_PROGRESS } });
      const baseUrl = await startServer({ loadItems, store, repos: [ITEM.repo, OTHER_REPO] });

      const response = await post(`${baseUrl}/api/items/refresh`, { repos: [OTHER_REPO] });

      expect(await response.json()).toStrictEqual({ items: [], reads: { [OTHER_REPO]: FRESH_READ } });
      expect(store.state.overrides).toStrictEqual({ [ITEM_KEY]: IN_PROGRESS });
    });
  });
});
