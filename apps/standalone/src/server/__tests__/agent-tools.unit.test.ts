import type { ItemScores, WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { buildAgentToolServer, createAgentTools, type SuggestedChange } from '../agent-tools.ts';
import { createItemsCache } from '../items-cache.ts';
import { connectToolClient } from '../test-utils/tool-client.ts';

const REPO = 'w/top-right';
const OTHER_REPO = 'w/other';
const AT = '2026-11-08T09:00:00.000Z';
const USER = 'github:author';

const EPIC = buildItem(1, { relations: [{ kind: 'sub-issue', ref: buildRef(2) }] });
const CHILD = buildItem(2, {
  labels: ['urgency:high'],
  relations: [{ kind: 'parent', ref: buildRef(1) }],
  createdAt: '2026-11-05T09:00:00Z',
});
const CLOSED = buildItem(3, { state: 'closed' });

describe(createAgentTools, () => {
  it('names the server as the permission policy expects', () => {
    expect(createAgentTools(buildOptions(createMemoryStore(), [])).name).toBe('topright');
  });

  it('lists each configured repository with its open count and newest item', async () => {
    const { callTool } = await setUp();

    await expect(callTool('list_repos')).resolves.toMatchObject({
      json: [
        { repo: REPO, openCount: 2, newestCreatedAt: '2026-11-05T09:00:00Z' },
        { repo: OTHER_REPO, openCount: 0 },
      ],
    });
  });

  it('lists the open items with their parent and the scores that their labels supply', async () => {
    const { callTool } = await setUp();

    const { json } = await callTool('list_items');

    expect(json).toMatchObject([
      { itemKey: `${REPO}#1`, title: EPIC.title },
      { itemKey: `${REPO}#2`, parent: `${REPO}#1`, scores: { urgency: { score: 'high', by: 'label' } } },
    ]);
  });

  it('lists an item’s sub-issues, and refuses a parent that the host has not read', async () => {
    const { callTool } = await setUp();

    await expect(callTool('list_items', { parent: `${REPO}#1` })).resolves.toMatchObject({
      json: [{ itemKey: `${REPO}#2`, state: 'open' }],
    });
    await expect(callTool('list_items', { parent: `${REPO}#99` })).resolves.toMatchObject({ isError: true });
  });

  it('refuses a repository that the config does not list', async () => {
    const { callTool } = await setUp();

    const answer = await callTool('list_items', { repos: ['w/elsewhere'] });

    expect(answer).toMatchObject({ isError: true, text: 'Not a configured repository: w/elsewhere' });
  });

  it('records a valid batch as the agent’s scores with each reason, dropping a level already held', async () => {
    const { callTool, store, suggestions } = await setUp();

    const answer = await callTool('suggest_scores', {
      changes: [
        { itemKey: `${REPO}#1`, scores: { value: 'must-have' }, reason: 'Unblocks the release' },
        { itemKey: `${REPO}#2`, scores: { urgency: 'high' }, reason: 'Held already' },
      ],
    });

    expect(answer).toMatchObject({ isError: false, json: { recorded: 1, items: 1 } });
    expect(store.state.scores).toStrictEqual({
      [`${REPO}#1`]: { value: { score: 'must-have', by: 'agent', at: AT, reason: 'Unblocks the release' } },
    });
    expect(suggestions).toStrictEqual([
      {
        changes: [
          { itemKey: `${REPO}#1`, field: 'value', from: undefined, to: 'must-have', reason: 'Unblocks the release' },
        ],
        scores: {
          [`${REPO}#1`]: { value: { score: 'must-have', by: 'agent', at: AT, reason: 'Unblocks the release' } },
        },
      },
    ]);
  });

  it.each([
    { case: 'a closed item', change: { itemKey: `${REPO}#3`, scores: { urgency: 'high' }, reason: 'r' } },
    { case: 'a level off the scale', change: { itemKey: `${REPO}#1`, scores: { urgency: 'urgent' }, reason: 'r' } },
    { case: 'a missing reason', change: { itemKey: `${REPO}#1`, scores: { urgency: 'high' } } },
  ])('refuses a batch with $case, recording nothing', async ({ change }) => {
    const { callTool, store, suggestions } = await setUp();

    const answer = await callTool('suggest_scores', {
      changes: [{ itemKey: `${REPO}#2`, scores: { value: 'nice-to-have' }, reason: 'Fine' }, change],
    });

    expect(answer.isError).toBe(true);
    expect(store.state.scores).toStrictEqual({});
    expect(suggestions).toStrictEqual([]);
  });

  it('refuses a batch that repeats an item or sets a level that the mapping lists no label for', async () => {
    const mapping = {
      urgency: { low: ['urgency:low'], medium: ['urgency:medium'], high: ['urgency:high'], critical: [] },
      value: {
        questionable: ['value:questionable'],
        'nice-to-have': ['value:nice-to-have'],
        'should-have': ['value:should-have'],
        'must-have': ['value:must-have'],
      },
      effort: {
        1: ['effort:1'],
        2: ['effort:2'],
        3: ['effort:3'],
        5: ['effort:5'],
        8: ['effort:8'],
        13: ['effort:13'],
      },
    };
    const { callTool } = await setUp({ scoreLabelMapping: mapping });

    const answer = await callTool('suggest_scores', {
      changes: [
        { itemKey: `${REPO}#1`, scores: { urgency: 'critical' }, reason: 'r' },
        { itemKey: `${REPO}#1`, scores: { value: 'must-have' }, reason: 'r' },
      ],
    });

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain('no label is mapped to urgency critical');
    expect(answer.text).toContain(`${REPO}#1 appears more than once`);
  });
});

// region | Helpers
/** Returns an item of the configured repository with `overrides` applied. */
function buildItem(number: number, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    repo: REPO,
    number,
    title: `Item ${number}`,
    url: `https://github.com/${REPO}/issues/${number}`,
    state: 'open',
    createdAt: '2026-11-01T09:00:00Z',
    labels: [],
    relations: [],
    ...overrides,
  };
}

/** Returns the reference of the configured repository's item `number`. */
function buildRef(number: number): WorkItem['relations'][number]['ref'] {
  const { repo, title, url, state } = buildItem(number);
  return { repo, number, title, url, state };
}

/** Returns the tools' options over `store` and the three items, recording each suggestion in `suggestions`. */
function buildOptions(
  store: ReturnType<typeof createMemoryStore>,
  suggestions: { changes: SuggestedChange[]; scores: Record<string, ItemScores> }[],
) {
  return {
    items: createItemsCache({ loadRepo: (repo) => Promise.resolve(repo === REPO ? [EPIC, CHILD, CLOSED] : []) }),
    repos: [REPO, OTHER_REPO],
    store,
    userId: USER,
    at: AT,
    onSuggested: (changes: SuggestedChange[], scores: Record<string, ItemScores>) => {
      suggestions.push({ changes, scores });
    },
  };
}

/** Connects a client to the tools over a memory store and the three items, recording each suggestion. */
async function setUp(initial: Parameters<typeof createMemoryStore>[0] = {}) {
  const store = createMemoryStore(initial);
  const suggestions: { changes: SuggestedChange[]; scores: Record<string, ItemScores> }[] = [];
  const callTool = await connectToolClient(buildAgentToolServer(buildOptions(store, suggestions)));
  return { callTool, store, suggestions };
}
// endregion | Helpers
