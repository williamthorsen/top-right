import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { closeServers, ITEM, post, startServer } from '../test-utils/api-server.ts';

afterEach(closeServers);

describe('POST /api/collections', () => {
  const repos = [ITEM.repo, 'w/codeassembly'];
  const CORE = { id: 'c1', name: 'Core', repos: [ITEM.repo, 'w/codeassembly'] };

  it('saves the collections with their names trimmed, and both GET routes answer with them', async () => {
    const store = createMemoryStore();
    const baseUrl = await startServer({ store, repos });

    const response = await post(`${baseUrl}/api/collections`, {
      collections: [{ ...CORE, name: ' Core ' }],
      defaultCollectionId: 'c1',
    });

    const saved = { collections: [CORE], defaultCollectionId: 'c1' };
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual(saved);
    expect(store.state.collections).toStrictEqual(saved);
    expect(await (await fetch(`${baseUrl}/api/settings`)).json()).toMatchObject(saved);
    expect(await (await fetch(`${baseUrl}/api/items`)).json()).toMatchObject(saved);
  });

  it('clears the default when the body states it as null', async () => {
    const store = createMemoryStore({ collections: { collections: [CORE], defaultCollectionId: 'c1' } });
    const baseUrl = await startServer({ store, repos });

    const response = await post(`${baseUrl}/api/collections`, { collections: [CORE], defaultCollectionId: null });

    expect(await response.json()).toStrictEqual({ collections: [CORE], defaultCollectionId: null });
    expect(store.state.collections).toStrictEqual({ collections: [CORE], defaultCollectionId: undefined });
  });

  it.each([
    {
      case: 'contains an empty name',
      collections: [{ ...CORE, name: ' ' }],
      defaultCollectionId: null,
      error: 'Give every collection a name.',
    },
    {
      case: 'repeats a name in another case',
      collections: [CORE, { id: 'c2', name: 'core', repos: [ITEM.repo] }],
      defaultCollectionId: null,
      error: 'More than one collection is named "core". Give each its own name.',
    },
    {
      case: 'contains a collection without repositories',
      collections: [{ ...CORE, repos: [] }],
      defaultCollectionId: null,
      error: '"Core" does not include any repository. Add one or delete the collection.',
    },
    {
      case: 'names a repository that is not configured',
      collections: [{ ...CORE, repos: ['w/gone'] }],
      defaultCollectionId: null,
      error: '"Core" includes w/gone, which the config does not list.',
    },
    {
      case: 'names an unknown default',
      collections: [CORE],
      defaultCollectionId: 'gone',
      error: 'The default collection does not exist. Choose another default.',
    },
  ])('refuses a body that $case and saves nothing', async ({ collections, defaultCollectionId, error }) => {
    const store = createMemoryStore();
    const baseUrl = await startServer({ store, repos });

    const response = await post(`${baseUrl}/api/collections`, { collections, defaultCollectionId });

    expect(response.status).toBe(400);
    expect(await response.json()).toStrictEqual({ error });
    expect(store.state.collections).toStrictEqual({ collections: [], defaultCollectionId: undefined });
  });

  it('answers each GET route with the collections without the repositories that the config does not list', async () => {
    const store = createMemoryStore({
      collections: { collections: [{ ...CORE, repos: [ITEM.repo, 'w/gone'] }], defaultCollectionId: undefined },
    });
    const baseUrl = await startServer({ store, repos });

    const expected = { collections: [{ ...CORE, repos: [ITEM.repo] }], defaultCollectionId: null };
    expect(await (await fetch(`${baseUrl}/api/settings`)).json()).toMatchObject(expected);
    expect(await (await fetch(`${baseUrl}/api/items`)).json()).toMatchObject(expected);
  });
});
