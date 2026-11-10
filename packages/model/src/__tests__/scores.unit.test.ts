import { describe, expect, it } from 'vitest';

import {
  applyScoreWrite,
  computeRemainingScope,
  isValidScore,
  type ItemScores,
  keepItemScores,
  rankLevel,
  readScoreValues,
} from '../scores.ts';

describe(isValidScore, () => {
  it.each([
    { field: 'urgency', value: 'low' },
    { field: 'urgency', value: 'critical' },
    { field: 'value', value: 'questionable' },
    { field: 'value', value: 'must-have' },
    { field: 'effort', value: 1 },
    { field: 'effort', value: 13 },
    { field: 'progress', value: 0 },
    { field: 'progress', value: 0.15 },
    { field: 'progress', value: 0.35 },
    { field: 'progress', value: 1 },
  ] as const)('accepts $value for $field', ({ field, value }) => {
    expect(isValidScore(field, value)).toBe(true);
  });

  it.each([
    { field: 'urgency', value: 3 },
    { field: 'urgency', value: 'must-have' },
    { field: 'urgency', value: 'High' },
    { field: 'value', value: 'critical' },
    { field: 'value', value: undefined },
    { field: 'effort', value: 'high' },
    { field: 'progress', value: '0.5' },
    { field: 'effort', value: 4 },
    { field: 'effort', value: 21 },
    { field: 'progress', value: -0.05 },
    { field: 'progress', value: 1.05 },
    { field: 'progress', value: 0.12 },
    { field: 'progress', value: NaN },
  ] as const)('rejects $value for $field', ({ field, value }) => {
    expect(isValidScore(field, value)).toBe(false);
  });
});

describe(rankLevel, () => {
  it.each([
    { level: 'low', rank: 1 },
    { level: 'critical', rank: 4 },
    { level: 'questionable', rank: 1 },
    { level: 'should-have', rank: 3 },
  ] as const)('ranks $level at $rank', ({ level, rank }) => {
    expect(rankLevel(level)).toBe(rank);
  });
});

describe(readScoreValues, () => {
  it('returns the values of the scored fields only', () => {
    const at = '2026-11-08T00:00:00.000Z';
    expect(
      readScoreValues({ urgency: { score: 'high', by: 'author', at }, effort: { score: 3, by: 'agent', at } }),
    ).toEqual({
      urgency: 'high',
      effort: 3,
    });
  });

  it('returns no values for an unscored item', () => {
    expect(readScoreValues(undefined)).toEqual({});
  });
});

describe(applyScoreWrite, () => {
  const EARLIER = '2026-11-01T09:00:00.000Z';
  const LATER = '2026-11-02T09:00:00.000Z';
  const LATEST = '2026-11-03T09:00:00.000Z';

  it('records the score that the author held when an agent changes it', () => {
    const existing: ItemScores = { urgency: { score: 'medium', by: 'author', at: EARLIER } };

    expect(applyScoreWrite(existing, { urgency: 'high' }, 'agent', LATER)).toEqual({
      urgency: { score: 'high', by: 'agent', at: LATER, previous: 'medium' },
    });
  });

  it('keeps the author-held score across repeated agent writes', () => {
    const once = applyScoreWrite(
      { value: { score: 'nice-to-have', by: 'author', at: EARLIER } },
      { value: 'must-have' },
      'agent',
      LATER,
    );

    expect(applyScoreWrite(once, { value: 'questionable' }, 'agent', LATEST)).toEqual({
      value: { score: 'questionable', by: 'agent', at: LATEST, previous: 'nice-to-have' },
    });
  });

  it('records no previous score for a field that was unscored', () => {
    expect(applyScoreWrite(undefined, { effort: 5 }, 'agent', LATER)).toEqual({
      effort: { score: 5, by: 'agent', at: LATER },
    });
  });

  it('leaves a field alone when an agent writes its current score', () => {
    const existing: ItemScores = { urgency: { score: 'medium', by: 'author', at: EARLIER } };

    expect(applyScoreWrite(existing, { urgency: 'medium' }, 'agent', LATER)).toEqual(existing);
  });

  it('turns every agent entry into the author’s when the author writes any field', () => {
    const existing: ItemScores = {
      urgency: { score: 'high', by: 'agent', at: EARLIER, previous: 'medium' },
      value: { score: 'nice-to-have', by: 'author', at: EARLIER },
      effort: { score: 5, by: 'agent', at: EARLIER },
    };

    expect(applyScoreWrite(existing, { value: 'must-have' }, 'author', LATER)).toEqual({
      urgency: { score: 'high', by: 'author', at: LATER },
      value: { score: 'must-have', by: 'author', at: LATER },
      effort: { score: 5, by: 'author', at: LATER },
    });
  });

  it('drops a previous score left on an author entry', () => {
    const existing: ItemScores = { urgency: { score: 'high', by: 'author', at: EARLIER, previous: 'medium' } };

    expect(applyScoreWrite(existing, { value: 'questionable' }, 'author', LATER)).toEqual({
      urgency: { score: 'high', by: 'author', at: EARLIER },
      value: { score: 'questionable', by: 'author', at: LATER },
    });
  });
});

describe(computeRemainingScope, () => {
  const at = '2026-11-01T09:00:00.000Z';

  it.each([
    { name: 'the effort when progress is missing', progress: undefined, expected: 8 },
    { name: 'the part not done', progress: 0.25, expected: 6 },
    { name: 'zero when the work is done', progress: 1, expected: 0 },
  ])('returns $name', ({ progress, expected }) => {
    const scores: ItemScores = {
      effort: { score: 8, by: 'author', at },
      ...(progress !== undefined && { progress: { score: progress, by: 'author', at } }),
    };

    expect(computeRemainingScope(scores)).toBe(expected);
  });

  it('returns undefined when the effort is unknown', () => {
    expect(computeRemainingScope({ progress: { score: 0.5, by: 'author', at } })).toBeUndefined();
    expect(computeRemainingScope(undefined)).toBeUndefined();
  });
});

describe(keepItemScores, () => {
  it('turns the agent entries into the author’s and leaves the author’s unchanged', () => {
    const at = '2026-11-02T09:00:00.000Z';
    const existing: ItemScores = {
      urgency: { score: 'high', by: 'agent', at: '2026-11-01T09:00:00.000Z', previous: 'medium' },
      value: { score: 'nice-to-have', by: 'author', at: '2026-10-01T09:00:00.000Z' },
    };

    expect(keepItemScores(existing, at)).toEqual({
      urgency: { score: 'high', by: 'author', at },
      value: { score: 'nice-to-have', by: 'author', at: '2026-10-01T09:00:00.000Z' },
    });
  });

  it('returns no scores for an item without any', () => {
    expect(keepItemScores(undefined, '2026-11-02T09:00:00.000Z')).toEqual({});
  });
});
