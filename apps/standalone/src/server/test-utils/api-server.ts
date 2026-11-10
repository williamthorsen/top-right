import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { WorkItem } from '@top-right/model';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { type ApiOptions, createApiHandler } from '../api.ts';
import { createItemsCache } from '../items-cache.ts';

export const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 11,
  title: 'Plot the issues',
  url: 'https://github.com/williamthorsen/top-right/issues/11',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: ['feature'],
  relations: [],
};
export const ITEM_KEY = 'williamthorsen/top-right#11';
export const NOW = new Date('2026-11-08T12:00:00.000Z');
export const EARLIER = '2026-11-01T09:00:00.000Z';

const servers: Server[] = [];

/** Closes every server that `startServer` started; a test file calls it after each test. */
export function closeServers(): void {
  for (const server of servers.splice(0)) server.close();
}

/** Posts `body` as JSON to `url`. */
export function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

/** Starts the API on a free port, with an items cache over `loadItems` unless `overrides` supplies one. */
export async function startServer({
  loadItems = () => Promise.resolve([ITEM]),
  ...overrides
}: Partial<ApiOptions> & { loadItems?: () => Promise<WorkItem[]> }): Promise<string> {
  const handle = createApiHandler({
    items: createItemsCache({ load: loadItems, now: () => NOW }),
    repos: [ITEM.repo],
    store: createMemoryStore(),
    userId: 'github:author',
    now: () => NOW,
    ...overrides,
  });
  const server = createServer((request, response) => void handle(request, response, () => response.end('next')));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server has no port');
  return `http://localhost:${(address satisfies AddressInfo).port}`;
}
