import { describe, expect, it } from 'vitest';

import { formatPoints, formatProvenance } from '../provenance.ts';

const NOW = new Date('2026-11-08T12:00:00');

describe(formatProvenance, () => {
  it('names the scorer and the day and month of the current year', () => {
    const line = formatProvenance({ score: 3, by: 'author', at: '2026-11-08T09:00:00' }, NOW);

    expect(line).toMatch(/^Author · /);
    expect(line).not.toContain('2026');
  });

  it('adds the year to a date in another year', () => {
    expect(formatProvenance({ score: 3, by: 'agent', at: '2025-03-02T09:00:00' }, NOW)).toMatch(/^Agent · .*2025/);
  });

  it('reads Unscored for an absent score', () => {
    expect(formatProvenance(undefined, NOW)).toBe('Unscored');
  });
});

describe(formatPoints, () => {
  it.each([
    { effort: 1, expected: '1 point' },
    { effort: 8, expected: '8 points' },
    { effort: undefined, expected: 'Unsized, drawn at the floor' },
  ])('reads "$expected" for an effort of $effort', ({ effort, expected }) => {
    expect(formatPoints(effort)).toBe(expected);
  });
});
