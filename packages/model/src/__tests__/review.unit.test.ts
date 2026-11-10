import { describe, expect, it } from 'vitest';

import { findTrailOrigin, isAgentScored, listReviewQueue } from '../review.ts';
import type {
  ItemScores,
  LabelScoreEntry,
  ResolvedItemScores,
  ScoreEntry,
  UrgencyLevel,
  ValueLevel,
} from '../scores.ts';

const AT = '2026-11-02T09:00:00.000Z';

describe(isAgentScored, () => {
  it('is true while any entry is the agent’s', () => {
    expect(isAgentScored({ urgency: author('high'), effort: agent(5) })).toBe(true);
  });

  it('is false for an item scored by the author alone or not at all', () => {
    expect(isAgentScored({ urgency: author('high') })).toBe(false);
    expect(isAgentScored(undefined)).toBe(false);
  });
});

describe(findTrailOrigin, () => {
  it('returns the previous cell of an item that the agent moved', () => {
    expect(
      findTrailOrigin({ urgency: agent('critical', 'medium'), value: agent('must-have', 'nice-to-have') }),
    ).toEqual({
      urgency: 'medium',
      value: 'nice-to-have',
    });
  });

  it('takes the current value of an axis that the author holds', () => {
    expect(findTrailOrigin({ urgency: author('critical'), value: agent('must-have', 'nice-to-have') })).toEqual({
      urgency: 'critical',
      value: 'nice-to-have',
    });
  });

  it('returns nothing for an item that the agent moved out of the gutter', () => {
    expect(findTrailOrigin({ urgency: agent('critical'), value: agent('must-have') })).toBeUndefined();
    expect(findTrailOrigin({ urgency: author('critical'), value: agent('must-have') })).toBeUndefined();
  });

  it('returns nothing once the author holds every score', () => {
    expect(
      findTrailOrigin({ urgency: { ...author('critical'), previous: 'medium' }, value: author('must-have') }),
    ).toBeUndefined();
  });

  it('returns nothing when the agent moved the item back to its previous cell', () => {
    expect(findTrailOrigin({ urgency: agent('medium', 'medium'), value: author('must-have') })).toBeUndefined();
  });
});

describe(listReviewQueue, () => {
  const items = [
    { repo: 'o/r', number: 1, state: 'open' },
    { repo: 'o/r', number: 2, state: 'open' },
    { repo: 'o/r', number: 3, state: 'open' },
    { repo: 'o/r', number: 4, state: 'closed' },
    { repo: 'o/r', number: 5, state: 'open' },
  ] as const;
  const scores: Record<string, ItemScores> = {
    'o/r#1': { urgency: agent('medium'), value: agent('must-have') },
    'o/r#2': { urgency: agent('high'), value: agent('must-have') },
    'o/r#3': { urgency: author('critical'), value: author('must-have') },
    'o/r#4': { urgency: agent('critical'), value: agent('must-have') },
    'o/r#5': { urgency: agent('critical') },
  };

  it('lists the open agent-scored items top-right first', () => {
    expect(listReviewQueue('agent', items, scores)).toEqual(['o/r#2', 'o/r#1', 'o/r#5']);
  });

  it('lists the open items that lack urgency or value', () => {
    expect(listReviewQueue('unscored', items, scores)).toEqual(['o/r#5']);
  });

  it('counts a label score as placing the item, and never as the agent’s', () => {
    const labelled: Record<string, ResolvedItemScores> = {
      'o/r#1': { urgency: label('high'), value: label('must-have') },
      'o/r#2': { urgency: label('high') },
    };

    expect(listReviewQueue('agent', items.slice(0, 2), labelled)).toEqual([]);
    expect(listReviewQueue('unscored', items.slice(0, 2), labelled)).toEqual(['o/r#2']);
  });
});

// region | Helpers
function agent<T extends number | UrgencyLevel | ValueLevel>(score: T, previous?: T): ScoreEntry<T> {
  return { score, by: 'agent', at: AT, ...(previous !== undefined && { previous }) };
}

function author<T extends number | UrgencyLevel | ValueLevel>(score: T): ScoreEntry<T> {
  return { score, by: 'author', at: AT };
}

function label<T extends UrgencyLevel | ValueLevel>(score: T): LabelScoreEntry<T> {
  return { score, by: 'label', label: score };
}
// endregion | Helpers
