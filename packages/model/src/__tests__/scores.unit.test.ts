import { describe, expect, it } from 'vitest';

import { applyScoreWrite, isValidScore, type ItemScores, keepItemScores, readScoreValues } from '../scores.ts';

describe(isValidScore, () => {
  it.each([
    { field: 'urgency', value: 1 },
    { field: 'urgency', value: 5 },
    { field: 'impact', value: 3 },
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
    { field: 'urgency', value: 0 },
    { field: 'urgency', value: 6 },
    { field: 'impact', value: 2.5 },
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

describe(readScoreValues, () => {
  it('returns the values of the scored fields only', () => {
    const at = '2026-11-08T00:00:00.000Z';
    expect(readScoreValues({ urgency: { value: 4, by: 'author', at }, effort: { value: 3, by: 'agent', at } })).toEqual(
      {
        urgency: 4,
        effort: 3,
      },
    );
  });

  it('returns no values for an unscored item', () => {
    expect(readScoreValues(undefined)).toEqual({});
  });
});

describe(applyScoreWrite, () => {
  const EARLIER = '2026-11-01T09:00:00.000Z';
  const LATER = '2026-11-02T09:00:00.000Z';
  const LATEST = '2026-11-03T09:00:00.000Z';

  it('records the value that the author held when an agent changes it', () => {
    const existing: ItemScores = { urgency: { value: 2, by: 'author', at: EARLIER } };

    expect(applyScoreWrite(existing, { urgency: 4 }, 'agent', LATER)).toEqual({
      urgency: { value: 4, by: 'agent', at: LATER, previous: 2 },
    });
  });

  it('keeps the author-held value across repeated agent writes', () => {
    const once = applyScoreWrite({ impact: { value: 3, by: 'author', at: EARLIER } }, { impact: 5 }, 'agent', LATER);

    expect(applyScoreWrite(once, { impact: 1 }, 'agent', LATEST)).toEqual({
      impact: { value: 1, by: 'agent', at: LATEST, previous: 3 },
    });
  });

  it('records no previous value for a field that was unscored', () => {
    expect(applyScoreWrite(undefined, { effort: 5 }, 'agent', LATER)).toEqual({
      effort: { value: 5, by: 'agent', at: LATER },
    });
  });

  it('leaves a field alone when an agent writes its current value', () => {
    const existing: ItemScores = { urgency: { value: 2, by: 'author', at: EARLIER } };

    expect(applyScoreWrite(existing, { urgency: 2 }, 'agent', LATER)).toEqual(existing);
  });

  it('turns every agent entry into the author’s when the author writes any field', () => {
    const existing: ItemScores = {
      urgency: { value: 4, by: 'agent', at: EARLIER, previous: 2 },
      impact: { value: 3, by: 'author', at: EARLIER },
      effort: { value: 5, by: 'agent', at: EARLIER },
    };

    expect(applyScoreWrite(existing, { impact: 5 }, 'author', LATER)).toEqual({
      urgency: { value: 4, by: 'author', at: LATER },
      impact: { value: 5, by: 'author', at: LATER },
      effort: { value: 5, by: 'author', at: LATER },
    });
  });

  it('drops a previous value left on an author entry', () => {
    const existing: ItemScores = { urgency: { value: 4, by: 'author', at: EARLIER, previous: 2 } };

    expect(applyScoreWrite(existing, { impact: 1 }, 'author', LATER)).toEqual({
      urgency: { value: 4, by: 'author', at: EARLIER },
      impact: { value: 1, by: 'author', at: LATER },
    });
  });
});

describe(keepItemScores, () => {
  it('turns the agent entries into the author’s and leaves the author’s unchanged', () => {
    const at = '2026-11-02T09:00:00.000Z';
    const existing: ItemScores = {
      urgency: { value: 4, by: 'agent', at: '2026-11-01T09:00:00.000Z', previous: 2 },
      impact: { value: 3, by: 'author', at: '2026-10-01T09:00:00.000Z' },
    };

    expect(keepItemScores(existing, at)).toEqual({
      urgency: { value: 4, by: 'author', at },
      impact: { value: 3, by: 'author', at: '2026-10-01T09:00:00.000Z' },
    });
  });

  it('returns no scores for an item without any', () => {
    expect(keepItemScores(undefined, '2026-11-02T09:00:00.000Z')).toEqual({});
  });
});
