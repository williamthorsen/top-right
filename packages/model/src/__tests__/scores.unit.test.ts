import { describe, expect, it } from 'vitest';

import { isValidScore, readScoreValues } from '../scores.ts';

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
