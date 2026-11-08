import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { WorkItem } from '@top-right/model';
import { afterEach, describe, expect, it } from 'vitest';

import { type ApiOptions, createApiHandler } from '../api.ts';

const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 11,
  title: 'Plot the issues',
  url: 'https://github.com/williamthorsen/top-right/issues/11',
  state: 'open',
  labels: ['feature'],
  relations: [],
};

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe(createApiHandler, () => {
  it('answers GET /api/items with the items and the abbreviations', async () => {
    const baseUrl = await startServer({
      loadItems: () => Promise.resolve([ITEM]),
      abbreviations: { [ITEM.repo]: 't' },
    });

    const response = await fetch(`${baseUrl}/api/items`);

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ items: [ITEM], abbreviations: { [ITEM.repo]: 't' } });
  });

  it('if loading fails, responds 502 with the failure message', async () => {
    const baseUrl = await startServer({
      loadItems: () => Promise.reject(new Error('GitHub rejected the token (401).')),
      abbreviations: {},
    });

    const response = await fetch(`${baseUrl}/api/items`);

    expect(response.status).toBe(502);
    expect(await response.json()).toStrictEqual({ error: 'GitHub rejected the token (401).' });
  });

  it('passes any other path to the next handler', async () => {
    const baseUrl = await startServer({ loadItems: () => Promise.resolve([]), abbreviations: {} });

    const response = await fetch(`${baseUrl}/index.html`);

    expect(await response.text()).toBe('next');
  });
});

// region | Helpers
async function startServer(options: ApiOptions): Promise<string> {
  const handle = createApiHandler(options);
  const server = createServer((request, response) => void handle(request, response, () => response.end('next')));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server has no port');
  return `http://localhost:${(address satisfies AddressInfo).port}`;
}
// endregion | Helpers
