import type { LabelScoreEntry, ScoreEntry, ScoreField } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { formatPoints, formatScoreCaption } from '../provenance.ts';

const NOW = new Date('2026-11-08T12:00:00');

const UNCAPTIONED: Array<{ case: string; field: ScoreField; entry: LabelScoreEntry | ScoreEntry | undefined }> = [
  { case: "an author's score", field: 'effort', entry: { score: 3, by: 'author', at: '2026-11-08T09:00:00' } },
  { case: 'a label score', field: 'value', entry: { score: 'must-have', by: 'label', label: 'value:must-have' } },
  { case: 'an absent urgency', field: 'urgency', entry: undefined },
];

describe(formatPoints, () => {
  it.each([
    { effort: 1, expected: '1 point' },
    { effort: 8, expected: '8 points' },
  ])('reads "$expected" for an effort of $effort', ({ effort, expected }) => {
    expect(formatPoints(effort)).toBe(expected);
  });
});

describe(formatScoreCaption, () => {
  it("names the agent and the day and month of the current year for an agent's score", () => {
    const caption = formatScoreCaption('urgency', { score: 'high', by: 'agent', at: '2026-11-08T09:00:00' }, NOW);

    expect(caption).toMatch(/^Agent · /);
    expect(caption).not.toContain('2026');
  });

  it('adds the year to a date in another year', () => {
    expect(formatScoreCaption('progress', { score: 0.5, by: 'agent', at: '2025-03-02T09:00:00' }, NOW)).toMatch(
      /^Agent · .*2025/,
    );
  });

  it('reads that an unsized item is drawn at the floor', () => {
    expect(formatScoreCaption('effort', undefined, NOW)).toBe('Unsized, drawn at the floor');
  });

  it.each(UNCAPTIONED)('gives no caption for $case', ({ field, entry }) => {
    expect(formatScoreCaption(field, entry, NOW)).toBeUndefined();
  });
});
