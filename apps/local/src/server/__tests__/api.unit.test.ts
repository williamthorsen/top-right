import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { StatusOverride, WorkItem } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ApiOptions, createApiHandler } from '../api.ts';
import { createMemoryStore } from '../test-utils/memory-store.ts';

const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 11,
  title: 'Plot the issues',
  url: 'https://github.com/williamthorsen/top-right/issues/11',
  state: 'open',
  labels: ['feature'],
  relations: [],
};
const ITEM_KEY = 'williamthorsen/top-right#11';
const NOW = new Date('2026-11-08T12:00:00.000Z');
const EARLIER = '2026-11-01T09:00:00.000Z';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: EARLIER };

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe(createApiHandler, () => {
  describe('GET /api/items', () => {
    it("answers with the items, the abbreviations, and the user's scores, overrides, and last visit", async () => {
      const scores = { [ITEM_KEY]: { urgency: { value: 4, by: 'author' as const, at: EARLIER } } };
      const store = createMemoryStore({ scores, overrides: { [ITEM_KEY]: IN_PROGRESS }, lastVisitAt: EARLIER });
      const baseUrl = await startServer({ store });

      const response = await fetch(`${baseUrl}/api/items`);

      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({
        items: [ITEM],
        abbreviations: { [ITEM.repo]: 't' },
        scores,
        overrides: { [ITEM_KEY]: IN_PROGRESS },
        lastVisitAt: EARLIER,
      });
    });

    it('deletes and omits an override whose item has changed state at its source', async () => {
      const store = createMemoryStore({ overrides: { [ITEM_KEY]: { ...IN_PROGRESS, sourceState: 'closed' } } });
      const baseUrl = await startServer({ store });

      const body: unknown = await (await fetch(`${baseUrl}/api/items`)).json();

      expect(body).toMatchObject({ overrides: {} });
      expect(store.state.overrides).toStrictEqual({});
    });

    it('if loading fails, responds 502 with the failure message', async () => {
      const baseUrl = await startServer({
        loadItems: () => Promise.reject(new Error('GitHub rejected the token (401).')),
      });

      const response = await fetch(`${baseUrl}/api/items`);

      expect(response.status).toBe(502);
      expect(await response.json()).toStrictEqual({ error: 'GitHub rejected the token (401).' });
    });
  });

  describe('POST /api/scores', () => {
    it("writes the scores as the author's, at the host's time, and answers with the item's scores", async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { impact: 5, progress: 0.4 } });

      const at = NOW.toISOString();
      const expected = { impact: { value: 5, by: 'author', at }, progress: { value: 0.4, by: 'author', at } };
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, scores: expected });
      expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
    });

    it.each([
      { case: 'a value is off its scale', scores: { effort: 4 }, field: 'scores.effort' },
      { case: 'the body names an unknown field', scores: { priority: 2 }, field: 'scores' },
      { case: 'the body names no score', scores: {}, field: 'scores' },
    ])('if $case, responds 400 naming the field', async ({ scores, field }) => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores });

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({ error: expect.stringContaining(field) });
      expect(store.state.scores).toStrictEqual({});
    });

    it('if the body is not JSON, responds 400', async () => {
      const baseUrl = await startServer({});

      const response = await fetch(`${baseUrl}/api/scores`, { method: 'POST', body: '{' });

      expect(response.status).toBe(400);
    });

    it('if the store fails, responds 500 with the failure message', async () => {
      const store = createMemoryStore();
      store.writeScores = () => Promise.reject(new Error('disk full'));
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { urgency: 1 } });

      expect(response.status).toBe(500);
      expect(await response.json()).toStrictEqual({ error: 'disk full' });
    });
  });

  describe('POST /api/status', () => {
    it('sets In progress as an override recorded against the source state', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/status`, {
        itemKey: ITEM_KEY,
        status: 'in-progress',
        sourceState: 'open',
      });

      const override = { status: 'in-progress', sourceState: 'open', at: NOW.toISOString() };
      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, override });
      expect(store.state.overrides[ITEM_KEY]).toStrictEqual(override);
    });

    it('clears the override when an open item returns to To do', async () => {
      const store = createMemoryStore({ overrides: { [ITEM_KEY]: IN_PROGRESS } });
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/status`, { itemKey: ITEM_KEY, status: 'to-do', sourceState: 'open' });

      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, override: null });
      expect(store.state.overrides).toStrictEqual({});
    });

    it('refuses a status for an item that is closed at its source', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/status`, {
        itemKey: ITEM_KEY,
        status: 'in-progress',
        sourceState: 'closed',
      });

      expect(response.status).toBe(400);
      expect(store.state.overrides).toStrictEqual({});
    });
  });

  describe('POST /api/visit', () => {
    it("records the host's time as the end of the visit", async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await fetch(`${baseUrl}/api/visit`, { method: 'POST' });

      expect(response.status).toBe(204);
      expect(store.state.lastVisitAt).toBe(NOW.toISOString());
    });

    it('if the store fails, still responds 204 and logs the failure', async () => {
      const store = createMemoryStore();
      store.writeLastVisit = () => Promise.reject(new Error('disk full'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const baseUrl = await startServer({ store });

      const response = await fetch(`${baseUrl}/api/visit`, { method: 'POST' });

      expect(response.status).toBe(204);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('disk full'));
      log.mockRestore();
    });
  });

  it('answers 405 for a method that the path does not take', async () => {
    const baseUrl = await startServer({});

    const response = await fetch(`${baseUrl}/api/scores`);

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('passes any other path to the next handler', async () => {
    const baseUrl = await startServer({});

    const response = await fetch(`${baseUrl}/index.html`);

    expect(await response.text()).toBe('next');
  });
});

// region | Helpers
function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function startServer(overrides: Partial<ApiOptions>): Promise<string> {
  const handle = createApiHandler({
    loadItems: () => Promise.resolve([ITEM]),
    abbreviations: { [ITEM.repo]: 't' },
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
// endregion | Helpers
