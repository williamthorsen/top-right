import { DEFAULT_SCORE_LABEL_MAPPING, type ItemScores, type ResolvedItemScores } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { omitHeldScores, parseScoreBatch, planScoreChanges, writeScoreBatch } from '../score-batch.ts';

const OPEN = new Set(['o/r#1', 'o/r#2']);
const AT = '2026-11-08T09:00:00.000Z';

describe(parseScoreBatch, () => {
  it('returns the entries of a valid batch without the fields that it omits', () => {
    expect(
      parseScoreBatch([{ itemKey: 'o/r#1', scores: { urgency: 'high', value: 'nice-to-have' } }], { openKeys: OPEN }),
    ).toStrictEqual({
      kind: 'valid',
      entries: [{ itemKey: 'o/r#1', scores: { urgency: 'high', value: 'nice-to-have' } }],
    });
  });

  it('refuses the whole batch, naming each offending entry', () => {
    const batch = [
      { itemKey: 'o/r#1', scores: { urgency: 'high' } },
      { itemKey: 'o/r#9', scores: { urgency: 'high' } },
      { itemKey: 'o/r#2', scores: { effort: 4 } },
      { itemKey: 'o/r#2', scores: {} },
      { itemKey: 'o/r#1', scores: { value: 'questionable' } },
    ];

    const parsed = parseScoreBatch(batch, { openKeys: OPEN });

    expect(parsed).toStrictEqual({
      kind: 'invalid',
      problems: [
        'entry 2: o/r#9 is not an open issue of a configured repository',
        expect.stringMatching(/^entry 3: scores\.effort: /),
        expect.stringMatching(/^entry 4: scores: /),
        'entry 5: o/r#1 appears more than once',
      ],
    });
  });

  it.each([
    { case: 'a number on an axis', scores: { urgency: 3 }, field: 'urgency' },
    { case: 'another axis’s level', scores: { value: 'critical' }, field: 'value' },
  ])('refuses $case, naming the field', ({ scores, field }) => {
    expect(parseScoreBatch([{ itemKey: 'o/r#1', scores }], { openKeys: OPEN })).toStrictEqual({
      kind: 'invalid',
      problems: [`entry 1: scores.${field}: not a valid ${field} score`],
    });
  });

  it('keeps an entry’s trimmed reason', () => {
    expect(
      parseScoreBatch([{ itemKey: 'o/r#1', scores: { urgency: 'high' }, reason: '  Blocks the release ' }], {
        openKeys: OPEN,
      }),
    ).toStrictEqual({
      kind: 'valid',
      entries: [{ itemKey: 'o/r#1', scores: { urgency: 'high' }, reason: 'Blocks the release' }],
    });
  });

  it('refuses a level that the given mapping lists no label for', () => {
    const mapping = { ...DEFAULT_SCORE_LABEL_MAPPING, urgency: { ...DEFAULT_SCORE_LABEL_MAPPING.urgency, high: [] } };

    expect(
      parseScoreBatch([{ itemKey: 'o/r#1', scores: { urgency: 'high' } }], { openKeys: OPEN, mapping }),
    ).toStrictEqual({
      kind: 'invalid',
      problems: ['entry 1: no label is mapped to urgency high; add one in Settings'],
    });
  });

  it('refuses input that is not an array', () => {
    expect(parseScoreBatch({ itemKey: 'o/r#1' }, { openKeys: OPEN })).toMatchObject({ kind: 'invalid' });
  });
});

describe(planScoreChanges, () => {
  it('reports each field whose value the write changes, and none that it leaves alone', () => {
    const scores: Record<string, ItemScores> = { 'o/r#1': { urgency: { score: 'medium', by: 'author', at: AT } } };

    const changes = planScoreChanges(
      [
        { itemKey: 'o/r#1', scores: { urgency: 'medium', value: 'must-have' } },
        { itemKey: 'o/r#2', scores: { effort: 3 } },
      ],
      scores,
      scores,
      AT,
    );

    expect(changes).toStrictEqual([
      { itemKey: 'o/r#1', field: 'value', from: undefined, to: 'must-have' },
      { itemKey: 'o/r#2', field: 'effort', from: undefined, to: 3 },
    ]);
  });

  it("reports a change from the level that the item's label supplies", () => {
    const resolved: Record<string, ResolvedItemScores> = {
      'o/r#1': { urgency: { score: 'low', by: 'label', label: 'urgency:low' } },
    };

    expect(planScoreChanges([{ itemKey: 'o/r#1', scores: { urgency: 'high' } }], {}, resolved, AT)).toStrictEqual([
      { itemKey: 'o/r#1', field: 'urgency', from: 'low', to: 'high' },
    ]);
  });
});

describe(omitHeldScores, () => {
  it('drops each score that the item already resolves to, and an entry left with none', () => {
    const resolved: Record<string, ResolvedItemScores> = {
      'o/r#1': { urgency: { score: 'high', by: 'label', label: 'urgency:high' } },
      'o/r#2': { value: { score: 'must-have', by: 'label', label: 'value:must-have' } },
    };

    expect(
      omitHeldScores(
        [
          { itemKey: 'o/r#1', scores: { urgency: 'high', effort: 3 } },
          { itemKey: 'o/r#2', scores: { value: 'must-have' } },
        ],
        resolved,
      ),
    ).toStrictEqual([{ itemKey: 'o/r#1', scores: { effort: 3 } }]);
  });
});

describe(writeScoreBatch, () => {
  it('writes each entry as the agent’s at one time', async () => {
    const store = createMemoryStore();

    await writeScoreBatch(store, 'github:author', [{ itemKey: 'o/r#1', scores: { urgency: 'high' } }], AT);

    expect(store.state.scores).toStrictEqual({ 'o/r#1': { urgency: { score: 'high', by: 'agent', at: AT } } });
  });

  it('stores each entry’s reason and returns the resulting scores', async () => {
    const store = createMemoryStore();

    const written = await writeScoreBatch(
      store,
      'github:author',
      [{ itemKey: 'o/r#1', scores: { value: 'must-have' }, reason: 'Core flow' }],
      AT,
    );

    expect(written).toStrictEqual({
      'o/r#1': { value: { score: 'must-have', by: 'agent', at: AT, reason: 'Core flow' } },
    });
  });
});
