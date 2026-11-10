import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  type ItemScores,
  type ScoreLabelMapping,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { type ApiOptions, createApiHandler } from '../api.ts';

const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 11,
  title: 'Plot the issues',
  url: 'https://github.com/williamthorsen/top-right/issues/11',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: ['feature'],
  relations: [],
};
const ITEM_KEY = 'williamthorsen/top-right#11';
const NOW = new Date('2026-11-08T12:00:00.000Z');
const EARLIER = '2026-11-01T09:00:00.000Z';
const MAPPING: WorkTypeMapping = { bug: ['defect'], feature: ['feat'], ops: [], task: ['chore'] };
const LABEL_MAPPING: ScoreLabelMapping = {
  urgency: { critical: [], high: ['priority:high'], low: [], medium: [] },
  value: { 'must-have': ['value:must-have'], 'nice-to-have': [], questionable: [], 'should-have': [] },
};
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: EARLIER };

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe(createApiHandler, () => {
  describe('GET /api/items', () => {
    it("answers with the items, the abbreviations, and the user's scores, overrides, and last visit", async () => {
      const scores: Record<string, ItemScores> = {
        [ITEM_KEY]: {
          urgency: { score: 'high', by: 'author', at: EARLIER },
          value: { score: 'must-have', by: 'agent', at: EARLIER, previous: 'should-have' },
        },
      };
      const store = createMemoryStore({ scores, overrides: { [ITEM_KEY]: IN_PROGRESS }, lastVisitAt: EARLIER });
      const baseUrl = await startServer({ store });

      const response = await fetch(`${baseUrl}/api/items`);

      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({
        items: [ITEM],
        abbreviations: { [ITEM.repo]: 't' },
        abbreviationClashes: [],
        workTypeMapping: DEFAULT_WORK_TYPE_MAPPING,
        scoreLabelMapping: DEFAULT_SCORE_LABEL_MAPPING,
        scores,
        overrides: { [ITEM_KEY]: IN_PROGRESS },
        lastVisitAt: EARLIER,
      });
    });

    it("resolves each configured repository's abbreviation from the user's stored ones", async () => {
      const store = createMemoryStore({ abbreviations: { [ITEM.repo]: 'tr', 'w/gone': 'g' } });
      const baseUrl = await startServer({ store, repos: [ITEM.repo, 'w/codeassembly'] });

      const body: unknown = await (await fetch(`${baseUrl}/api/items`)).json();

      expect(body).toMatchObject({ abbreviations: { [ITEM.repo]: 'tr', 'w/codeassembly': 'c' } });
    });

    it("answers with the user's mappings and the repositories that share an abbreviation", async () => {
      const store = createMemoryStore({ workTypeMapping: MAPPING, scoreLabelMapping: LABEL_MAPPING });
      const baseUrl = await startServer({ store, repos: [ITEM.repo, 'w/tools'] });

      const body: unknown = await (await fetch(`${baseUrl}/api/items`)).json();

      expect(body).toMatchObject({
        workTypeMapping: MAPPING,
        scoreLabelMapping: LABEL_MAPPING,
        abbreviationClashes: [{ abbreviation: 't', repos: [ITEM.repo, 'w/tools'] }],
      });
    });

    it('deletes and omits the override of an item of a loaded repository that is no longer open', async () => {
      const closedKey = 'williamthorsen/top-right#9';
      const store = createMemoryStore({ overrides: { [ITEM_KEY]: IN_PROGRESS, [closedKey]: IN_PROGRESS } });
      const baseUrl = await startServer({ store });

      const body: unknown = await (await fetch(`${baseUrl}/api/items`)).json();

      expect(body).toMatchObject({ overrides: { [ITEM_KEY]: IN_PROGRESS } });
      expect(store.state.overrides).toStrictEqual({ [ITEM_KEY]: IN_PROGRESS });
    });

    it('keeps the override of an item whose repository the host no longer loads', async () => {
      const otherKey = 'williamthorsen/elsewhere#3';
      const store = createMemoryStore({ overrides: { [otherKey]: IN_PROGRESS } });
      const baseUrl = await startServer({ store });

      await fetch(`${baseUrl}/api/items`);

      expect(store.state.overrides).toStrictEqual({ [otherKey]: IN_PROGRESS });
    });

    it('deletes and omits an override recorded against a state that the item no longer has', async () => {
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

  describe('POST /api/keep', () => {
    it("keeps the item's agent scores as the author's, at the host's time, and answers with them", async () => {
      const store = createMemoryStore({
        scores: { [ITEM_KEY]: { urgency: { score: 'high', by: 'agent', at: EARLIER, previous: 'medium' } } },
      });
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/keep`, { itemKey: ITEM_KEY });

      const expected = { urgency: { score: 'high', by: 'author', at: NOW.toISOString() } };
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, scores: expected });
      expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
    });

    it('if the body names no item, responds 400', async () => {
      const baseUrl = await startServer({});

      const response = await post(`${baseUrl}/api/keep`, {});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/scores', () => {
    it("writes the scores as the author's, at the host's time, and answers with the item's scores", async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/scores`, {
        itemKey: ITEM_KEY,
        scores: { value: 'must-have', progress: 0.4 },
      });

      const at = NOW.toISOString();
      const expected = { value: { score: 'must-have', by: 'author', at }, progress: { score: 0.4, by: 'author', at } };
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, scores: expected });
      expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
    });

    it.each([
      { case: 'a number is off its scale', scores: { effort: 4 }, field: 'scores.effort' },
      { case: 'an axis score is a number', scores: { urgency: 3 }, field: 'scores.urgency' },
      { case: 'a level is not on its axis', scores: { value: 'high' }, field: 'scores.value' },
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

      const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { urgency: 'low' } });

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

  describe('GET /api/settings', () => {
    it("answers with the configured repositories and the user's stored settings", async () => {
      const store = createMemoryStore({
        abbreviations: { [ITEM.repo]: 'tr' },
        workTypeMapping: MAPPING,
        scoreLabelMapping: LABEL_MAPPING,
      });
      const baseUrl = await startServer({ store });

      expect(await (await fetch(`${baseUrl}/api/settings`)).json()).toStrictEqual({
        repos: [ITEM.repo],
        abbreviations: { [ITEM.repo]: 'tr' },
        workTypeMapping: MAPPING,
        scoreLabelMapping: LABEL_MAPPING,
      });
    });

    it('answers a null mapping when the user keeps the default', async () => {
      const baseUrl = await startServer({});

      expect(await (await fetch(`${baseUrl}/api/settings`)).json()).toMatchObject({
        workTypeMapping: null,
        scoreLabelMapping: null,
      });
    });
  });

  describe('POST /api/work-type-mapping', () => {
    it('saves the mapping with its labels trimmed and empty ones dropped', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/work-type-mapping`, {
        mapping: { ...MAPPING, bug: [' defect ', ''] },
      });

      expect(response.status).toBe(200);
      expect(store.state.workTypeMapping).toStrictEqual({ ...MAPPING, bug: ['defect'] });
    });

    it('restores the default on a null mapping', async () => {
      const store = createMemoryStore({ workTypeMapping: MAPPING });
      const baseUrl = await startServer({ store });

      await post(`${baseUrl}/api/work-type-mapping`, { mapping: null });

      expect(store.state.workTypeMapping).toBeUndefined();
    });

    it('refuses a label in two work types and saves nothing', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/work-type-mapping`, { mapping: { ...MAPPING, task: ['Defect'] } });

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({ error: '"defect" is in Bug and Task. Keep it in one type.' });
      expect(store.state.workTypeMapping).toBeUndefined();
    });
  });

  describe('POST /api/score-label-mapping', () => {
    it('saves the mapping with its labels trimmed and empty ones dropped', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/score-label-mapping`, {
        mapping: { ...LABEL_MAPPING, urgency: { ...LABEL_MAPPING.urgency, low: [' later ', ''] } },
      });

      expect(response.status).toBe(200);
      expect(store.state.scoreLabelMapping).toStrictEqual({
        ...LABEL_MAPPING,
        urgency: { ...LABEL_MAPPING.urgency, low: ['later'] },
      });
    });

    it('restores the default on a null mapping', async () => {
      const store = createMemoryStore({ scoreLabelMapping: LABEL_MAPPING });
      const baseUrl = await startServer({ store });

      await post(`${baseUrl}/api/score-label-mapping`, { mapping: null });

      expect(store.state.scoreLabelMapping).toBeUndefined();
    });

    it('refuses a label under two levels and saves nothing', async () => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store });

      const response = await post(`${baseUrl}/api/score-label-mapping`, {
        mapping: { ...LABEL_MAPPING, value: { ...LABEL_MAPPING.value, questionable: ['Priority:High'] } },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({
        error: '"priority:high" is under urgency high and value questionable. Keep it under one level.',
      });
      expect(store.state.scoreLabelMapping).toBeUndefined();
    });

    it('refuses a mapping that omits a level', async () => {
      const baseUrl = await startServer({});

      const response = await post(`${baseUrl}/api/score-label-mapping`, {
        mapping: { ...LABEL_MAPPING, urgency: { critical: [], high: [], low: [] } },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/abbreviations', () => {
    const repos = [ITEM.repo, 'w/codeassembly', 'w/configs.macos'];

    it("replaces the configured repositories' abbreviations, keeping those of other repositories", async () => {
      const store = createMemoryStore({ abbreviations: { [ITEM.repo]: 'tr', 'w/gone': 'g' } });
      const baseUrl = await startServer({ store, repos });

      const response = await post(`${baseUrl}/api/abbreviations`, {
        abbreviations: { [ITEM.repo]: '', 'w/codeassembly': ' ca ', 'w/configs.macos': 'cm' },
      });

      expect(response.status).toBe(200);
      expect(store.state.abbreviations).toStrictEqual({
        'w/gone': 'g',
        'w/codeassembly': 'ca',
        'w/configs.macos': 'cm',
      });
    });

    it.each([
      {
        case: 'leaves two repositories sharing an abbreviation',
        abbreviations: { 'w/codeassembly': 'C' },
        error: '"c" is used by w/codeassembly and w/configs.macos. Give each its own abbreviation.',
      },
      {
        case: 'sets an abbreviation that contains a dot',
        abbreviations: { 'w/codeassembly': 'c.a' },
        error: '"c.a" is not a valid abbreviation for w/codeassembly. Leave out spaces and dots.',
      },
      {
        case: 'names a repository that is not configured',
        abbreviations: { 'w/gone': 'g' },
        error: 'w/gone is not a configured repository. Reload Settings.',
      },
    ])('refuses a body that $case and saves nothing', async ({ abbreviations, error }) => {
      const store = createMemoryStore();
      const baseUrl = await startServer({ store, repos });

      const response = await post(`${baseUrl}/api/abbreviations`, { abbreviations });

      expect(response.status).toBe(400);
      expect(await response.json()).toStrictEqual({ error });
      expect(store.state.abbreviations).toStrictEqual({});
    });
  });
});

// region | Helpers
function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function startServer(overrides: Partial<ApiOptions>): Promise<string> {
  const handle = createApiHandler({
    loadItems: () => Promise.resolve([ITEM]),
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
// endregion | Helpers
