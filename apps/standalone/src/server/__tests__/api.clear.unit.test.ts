import type { ItemScores, ScoreEntry, UrgencyLevel, ValueLevel } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import type { LabelWriter } from '../label-write.ts';
import { closeServers, EARLIER, ITEM, ITEM_KEY, post, startServer } from '../test-utils/api-server.ts';

const REF = { repo: ITEM.repo, number: ITEM.number };
const URGENCY: ScoreEntry<UrgencyLevel> = { score: 'critical', by: 'agent', at: EARLIER, previous: 'low' };
const VALUE: ScoreEntry<ValueLevel> = { score: 'must-have', by: 'agent', at: EARLIER };
const PROGRESS: ScoreEntry<number> = { score: 0.5, by: 'author', at: EARLIER };
const STORED: ItemScores = { urgency: URGENCY, value: VALUE, progress: PROGRESS };

afterEach(closeServers);

describe('POST /api/scores/clear', () => {
  it("on a host without a label writer, removes the fields' entries and answers with the remaining scores", async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const baseUrl = await startServer({ store });

    const response = await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['urgency', 'progress'] });

    const expected: ItemScores = { value: VALUE };
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ itemKey: ITEM_KEY, scores: expected });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
  });

  it("on a label-writing host, removes the dimension's labels first and leaves the other scores alone", async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const labelWriter = createLabelWriter(['feature', 'value:must-have']);
    const baseUrl = await startServer({ store, labelWriter });
    await fetch(`${baseUrl}/api/items`);

    const response = await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['urgency'] });

    expect(labelWriter).toHaveBeenCalledWith(REF, {
      kind: 'change',
      add: [],
      remove: ['urgency:low', 'urgency:medium', 'urgency:high', 'urgency:critical'],
    });
    const expected: ItemScores = { value: VALUE, progress: PROGRESS };
    expect(await response.json()).toStrictEqual({
      itemKey: ITEM_KEY,
      scores: expected,
      labels: ['feature', 'value:must-have'],
    });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(expected);
    const items: unknown = await (await fetch(`${baseUrl}/api/items`)).json();
    expect(items).toMatchObject({ items: [{ labels: ['feature', 'value:must-have'] }] });
  });

  it('when only progress is cleared, writes no label', async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const labelWriter = createLabelWriter([]);
    const baseUrl = await startServer({ store, labelWriter });

    const response = await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['progress'] });

    expect(labelWriter).not.toHaveBeenCalled();
    expect(await response.json()).toStrictEqual({
      itemKey: ITEM_KEY,
      scores: { urgency: URGENCY, value: VALUE },
    });
  });

  it('if GitHub refuses the label write, answers 502 with the reason and leaves the store unchanged', async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const labelWriter = vi.fn<LabelWriter>(() => Promise.reject(new Error('GitHub refused the label change')));
    const baseUrl = await startServer({ store, labelWriter });

    const response = await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['value'] });

    expect(response.status).toBe(502);
    expect(await response.json()).toStrictEqual({ error: expect.stringContaining('refused the label change') });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(STORED);
  });

  it('if the store fails after the label write, answers 500 saying that the labels changed', async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    store.clearScores = () => Promise.reject(new Error('disk full'));
    const baseUrl = await startServer({ store, labelWriter: createLabelWriter([]) });

    const response = await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['effort'] });

    expect(response.status).toBe(500);
    expect(await response.json()).toStrictEqual({ error: expect.stringMatching(/labels changed.*disk full/) });
  });

  it('clears a field named twice once', async () => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const clearScores = vi.spyOn(store, 'clearScores');
    const baseUrl = await startServer({ store });

    await post(`${baseUrl}/api/scores/clear`, { itemKey: ITEM_KEY, fields: ['progress', 'progress'] });

    expect(clearScores).toHaveBeenCalledWith('github:author', ITEM_KEY, ['progress']);
  });

  it.each([
    { case: 'the body names no fields', body: { itemKey: ITEM_KEY }, error: 'fields' },
    { case: 'the fields are empty', body: { itemKey: ITEM_KEY, fields: [] }, error: 'fields' },
    { case: 'a field is unknown', body: { itemKey: ITEM_KEY, fields: ['priority'] }, error: 'fields' },
  ])('if $case, responds 400 naming the field and leaves the store unchanged', async ({ body, error }) => {
    const store = createMemoryStore({ scores: { [ITEM_KEY]: STORED } });
    const baseUrl = await startServer({ store });

    const response = await post(`${baseUrl}/api/scores/clear`, body);

    expect(response.status).toBe(400);
    expect(await response.json()).toStrictEqual({ error: expect.stringContaining(error) });
    expect(store.state.scores[ITEM_KEY]).toStrictEqual(STORED);
  });
});

// region | Helpers
/** Returns a label writer that records its calls and resolves to `labels`. */
function createLabelWriter(labels: string[]) {
  return vi.fn<LabelWriter>(() => Promise.resolve(labels));
}
// endregion | Helpers
