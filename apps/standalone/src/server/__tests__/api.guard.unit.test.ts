import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { createApiHandler } from '../api.ts';
import { closeServers, ITEM_KEY, NOW, send, startServer } from '../test-utils/api-server.ts';

const SCORES_BODY = JSON.stringify({ itemKey: ITEM_KEY, scores: { urgency: 'low' } });
const JSON_TYPE = { 'content-type': 'application/json' };

afterEach(closeServers);

describe(createApiHandler, () => {
  describe('Host', () => {
    it.each(['localhost', '127.0.0.1', '[::1]', 'LOCALHOST'])('answers under %s at its own port', async (name) => {
      const baseUrl = await startServer({});

      const status = await send(`${baseUrl}/api/items`, { headers: { host: `${name}:${portOf(baseUrl)}` } });

      expect(status).toBe(200);
    });

    it.each([
      ['evil.example', 0],
      ['localhost.evil.example', 0],
      ['localhost', 1],
    ])('refuses %s at port offset %d', async (name, portOffset) => {
      const baseUrl = await startServer({});
      const port = Number(portOf(baseUrl)) + portOffset;

      const status = await send(`${baseUrl}/api/items`, { headers: { host: `${name}:${port}` } });

      expect(status).toBe(403);
    });

    it('refuses a write under a foreign name before its handler runs', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const status = await send(`${baseUrl}/api/scores`, {
        method: 'POST',
        headers: { ...JSON_TYPE, host: `evil.example:${portOf(baseUrl)}` },
        body: SCORES_BODY,
      });

      expect(status).toBe(403);
      expect(store.state.scores).toStrictEqual({});
    });
  });

  describe('write requests', () => {
    it("accepts a JSON write from the host's own page", async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const status = await send(`${baseUrl}/api/scores`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          origin: baseUrl,
          'sec-fetch-site': 'same-origin',
        },
        body: SCORES_BODY,
      });

      expect(status).toBe(200);
      expect(store.state.scores).not.toStrictEqual({});
    });

    it.each([
      ['a foreign Origin', { ...JSON_TYPE, origin: 'http://evil.example' }],
      ['the Origin of another loopback name', { ...JSON_TYPE, origin: 'http://127.0.0.1:1' }],
      ['Sec-Fetch-Site: cross-site', { ...JSON_TYPE, 'sec-fetch-site': 'cross-site' }],
      ['Sec-Fetch-Site: same-site', { ...JSON_TYPE, 'sec-fetch-site': 'same-site' }],
      ['a text/plain body', { 'content-type': 'text/plain' }],
      ['a body without a Content-Type', {}],
      ['a chunked body without a Content-Type', { 'transfer-encoding': 'chunked' }],
    ])('refuses a write with %s before its handler runs', async (_case, headers) => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const status = await send(`${baseUrl}/api/scores`, { method: 'POST', headers, body: SCORES_BODY });

      expect(status).toBe(403);
      expect(store.state.scores).toStrictEqual({});
    });

    it.each([
      ['from a client outside the browser', () => ({})],
      ["from the host's own page", (baseUrl: string) => ({ origin: baseUrl, 'sec-fetch-site': 'same-origin' })],
    ])('accepts the visit beacon, which sends no body, %s', async (_case, headersFor) => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const status = await send(`${baseUrl}/api/visit`, {
        method: 'POST',
        headers: { ...headersFor(baseUrl), 'content-length': 0 },
      });

      expect(status).toBe(204);
      expect(store.state.lastVisitAt).toBe(NOW.toISOString());
    });

    it('refuses the visit beacon from another site', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const status = await send(`${baseUrl}/api/visit`, {
        method: 'POST',
        headers: { origin: 'http://evil.example', 'content-length': 0 },
      });

      expect(status).toBe(403);
      expect(store.state.lastVisitAt).toBeUndefined();
    });
  });
});

// region | Helpers
/** Returns the port at which the server that `startServer` started listens. */
function portOf(baseUrl: string): string {
  return new URL(baseUrl).port;
}
// endregion | Helpers
