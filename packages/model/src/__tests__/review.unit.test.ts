import { describe, expect, it } from 'vitest';

import { findTrailOrigin, isAgentScored, listReviewQueue } from '../review.ts';
import type { ItemScores, ScoreEntry } from '../scores.ts';

const AT = '2026-11-02T09:00:00.000Z';

describe(isAgentScored, () => {
  it('is true while any entry is the agent’s', () => {
    expect(isAgentScored({ urgency: author(3), effort: agent(5) })).toBe(true);
  });

  it('is false for an item scored by the author alone or not at all', () => {
    expect(isAgentScored({ urgency: author(3) })).toBe(false);
    expect(isAgentScored(undefined)).toBe(false);
  });
});

describe(findTrailOrigin, () => {
  it('returns the previous cell of an item that the agent moved', () => {
    expect(findTrailOrigin({ urgency: agent(4, 2), impact: agent(5, 3) })).toEqual({ urgency: 2, impact: 3 });
  });

  it('takes the current value of an axis that the author holds', () => {
    expect(findTrailOrigin({ urgency: author(4), impact: agent(5, 3) })).toEqual({ urgency: 4, impact: 3 });
  });

  it('returns nothing for an item that the agent moved out of the gutter', () => {
    expect(findTrailOrigin({ urgency: agent(4), impact: agent(5) })).toBeUndefined();
    expect(findTrailOrigin({ urgency: author(4), impact: agent(5) })).toBeUndefined();
  });

  it('returns nothing once the author holds every score', () => {
    expect(findTrailOrigin({ urgency: { ...author(4), previous: 2 }, impact: author(5) })).toBeUndefined();
  });

  it('returns nothing when the agent moved the item back to its previous cell', () => {
    expect(findTrailOrigin({ urgency: agent(2, 2), impact: author(5) })).toBeUndefined();
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
    'o/r#1': { urgency: agent(2), impact: agent(5) },
    'o/r#2': { urgency: agent(4), impact: agent(5) },
    'o/r#3': { urgency: author(5), impact: author(5) },
    'o/r#4': { urgency: agent(5), impact: agent(5) },
    'o/r#5': { urgency: agent(5) },
  };

  it('lists the open agent-scored items top-right first', () => {
    expect(listReviewQueue('agent', items, scores)).toEqual(['o/r#2', 'o/r#1', 'o/r#5']);
  });

  it('lists the open items that lack urgency or impact', () => {
    expect(listReviewQueue('unscored', items, scores)).toEqual(['o/r#5']);
  });
});

// region | Helpers
function agent(value: number, previous?: number): ScoreEntry {
  return { value, by: 'agent', at: AT, ...(previous !== undefined && { previous }) };
}

function author(value: number): ScoreEntry {
  return { value, by: 'author', at: AT };
}
// endregion | Helpers
