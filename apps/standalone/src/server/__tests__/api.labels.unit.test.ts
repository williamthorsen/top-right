import { DEFAULT_SCORE_LABEL_MAPPING, type ItemScores, type ScoreLabelMapping } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import type { LabelWriter } from '../label-write.ts';
import { closeServers, EARLIER, ITEM, ITEM_KEY, NOW, post, startServer } from '../test-utils/api-server.ts';

const REF = { repo: ITEM.repo, number: ITEM.number };
const AT = NOW.toISOString();

afterEach(closeServers);

describe('author writes on a host that writes labels', () => {
  it('writes the levels of a drag to the labels, keeps none in the store, and serves the new labels', async () => {
    const store = createMemoryStore();
    const labelWriter = createLabelWriter(['feature', 'urgency:high', 'value:must-have']);
    const baseUrl = await startServer({ store, labelWriter });
    await fetch(`${baseUrl}/api/items`);

    const response = await post(`${baseUrl}/api/scores`, {
      itemKey: ITEM_KEY,
      scores: { urgency: 'high', value: 'must-have' },
    });

    expect(labelWriter).toHaveBeenCalledWith(REF, {
      kind: 'change',
      add: ['urgency:high', 'value:must-have'],
      remove: expect.arrayContaining(['urgency:low', 'value:questionable']),
    });
    expect(await response.json()).toStrictEqual({
      itemKey: ITEM_KEY,
      scores: {},
      labels: ['feature', 'urgency:high', 'value:must-have'],
    });
    expect(store.state.scores).toStrictEqual({});
    const items: unknown = await (await fetch(`${baseUrl}/api/items`)).json();
    expect(items).toMatchObject({ items: [{ labels: ['feature', 'urgency:high', 'value:must-have'] }] });
  });

  it("on a Keep, writes the agent's levels to the labels and keeps the agent's progress as the author's", async () => {
    const store = createMemoryStore({
      scores: {
        [ITEM_KEY]: {
          urgency: { score: 'critical', by: 'agent', at: EARLIER, previous: 'low' },
          progress: { score: 0.5, by: 'agent', at: EARLIER },
        },
      },
    });
    const labelWriter = createLabelWriter(['urgency:critical']);
    const baseUrl = await startServer({ store, labelWriter });

    const response = await post(`${baseUrl}/api/keep`, { itemKey: ITEM_KEY });

    expect(labelWriter).toHaveBeenCalledWith(REF, expect.objectContaining({ add: ['urgency:critical'] }));
    const expected: ItemScores = { progress: { score: 0.5, by: 'author', at: AT } };
    expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, scores: expected, labels: ['urgency:critical'] });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
  });

  it('when the author writes progress, moves a level that the store holds to the labels', async () => {
    const store = createMemoryStore({
      scores: { [ITEM_KEY]: { value: { score: 'must-have', by: 'author', at: EARLIER } } },
    });
    const labelWriter = createLabelWriter(['value:must-have']);
    const baseUrl = await startServer({ store, labelWriter });

    await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { progress: 0.3 } });

    expect(labelWriter).toHaveBeenCalledWith(REF, expect.objectContaining({ add: ['value:must-have'] }));
    expect(store.state.scores[ITEM_KEY]).toStrictEqual({ progress: { score: 0.3, by: 'author', at: AT } });
  });

  it('if the item has no level to write, writes no label and answers without labels', async () => {
    const store = createMemoryStore();
    const labelWriter = createLabelWriter([]);
    const baseUrl = await startServer({ store, labelWriter });

    const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { progress: 0.3 } });

    expect(labelWriter).not.toHaveBeenCalled();
    expect(await response.json()).toStrictEqual({
      itemKey: ITEM_KEY,
      scores: { progress: { score: 0.3, by: 'author', at: AT } },
    });
  });

  it.each([
    {
      case: 'the mapping lists no label for the level',
      mapping: { ...DEFAULT_SCORE_LABEL_MAPPING, urgency: { ...DEFAULT_SCORE_LABEL_MAPPING.urgency, high: [] } },
      writer: createLabelWriter([]),
      status: 400,
      error: 'urgency high',
    },
    {
      case: 'GitHub refuses the label write',
      mapping: undefined,
      writer: vi.fn<LabelWriter>(() => Promise.reject(new Error('owner/repo has no label "urgency:high"'))),
      status: 502,
      error: 'no label "urgency:high"',
    },
  ])('if $case, answers $status with the reason and leaves the store unchanged', async (row) => {
    const stored: ItemScores = { urgency: { score: 'low', by: 'agent', at: EARLIER } };
    const scoreLabelMapping: ScoreLabelMapping | undefined = row.mapping;
    const store = createMemoryStore({ scores: { [ITEM_KEY]: stored }, scoreLabelMapping });
    const baseUrl = await startServer({ store, labelWriter: row.writer });

    const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { urgency: 'high' } });

    expect(response.status).toBe(row.status);
    expect(await response.json()).toStrictEqual({ error: expect.stringContaining(row.error) });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(stored);
  });

  it('if the store fails after the label write, answers 500 saying that the labels changed', async () => {
    const store = createMemoryStore();
    store.writeScores = () => Promise.reject(new Error('disk full'));
    const baseUrl = await startServer({ store, labelWriter: createLabelWriter(['urgency:low']) });

    const response = await post(`${baseUrl}/api/scores`, { itemKey: ITEM_KEY, scores: { urgency: 'low' } });

    expect(response.status).toBe(500);
    expect(await response.json()).toStrictEqual({ error: expect.stringMatching(/labels changed.*disk full/) });
  });
});

// region | Helpers
/** Returns a label writer that records its calls and resolves to `labels`. */
function createLabelWriter(labels: string[]) {
  return vi.fn<LabelWriter>(() => Promise.resolve(labels));
}
// endregion | Helpers
