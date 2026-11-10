import { describe, expect, it } from 'vitest';

import { findNextPick } from '../pick.ts';
import type { ItemScores, ResolvedItemScores, Scorer, Scores } from '../scores.ts';
import type { StatusOverride } from '../status.ts';
import type { WorkItem } from '../work-item.ts';

const AT = '2026-11-08T09:00:00.000Z';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: AT };

describe(findNextPick, () => {
  it('picks the highest rank of urgency plus value', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'high', value: 'nice-to-have' }),
      'o/r#2': score({ urgency: 'critical', value: 'should-have' }),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('breaks a tie on the sum by value', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'critical', value: 'nice-to-have' }),
      'o/r#2': score({ urgency: 'medium', value: 'must-have' }),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('then puts an item in progress before one to do', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'high', value: 'should-have' }),
      'o/r#2': score({ urgency: 'high', value: 'should-have' }),
    };

    expect(findNextPick(items, scores, { 'o/r#2': IN_PROGRESS })).toBe('o/r#2');
  });

  it('then takes the least remaining scope, counting a missing progress as none done', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'high', value: 'should-have', effort: 3 }),
      'o/r#2': score({ urgency: 'high', value: 'should-have', effort: 8, progress: 0.75 }),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('sorts an item without effort after one with any effort', () => {
    const items = [buildItem(1, '2026-01-01T00:00:00Z'), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'high', value: 'should-have' }),
      'o/r#2': score({ urgency: 'high', value: 'should-have', effort: 13 }),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('then takes the oldest', () => {
    const items = [buildItem(1, '2026-11-02T00:00:00Z'), buildItem(2, '2026-10-01T00:00:00Z')];
    const scores = {
      'o/r#1': score({ urgency: 'high', value: 'should-have' }),
      'o/r#2': score({ urgency: 'high', value: 'should-have' }),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('places an item by a label score as by a stored one', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'medium', value: 'should-have' }),
      'o/r#2': {
        urgency: { score: 'critical', by: 'label', label: 'urgency:critical' },
        value: { score: 'must-have', by: 'label', label: 'value:must-have' },
      } satisfies ResolvedItemScores,
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('never picks an item that an open item blocks, loaded or not', () => {
    const blocked: WorkItem = {
      ...buildItem(1),
      relations: [
        { kind: 'blocked-by', ref: { repo: 'o/other', number: 9, title: 'Elsewhere', url: '', state: 'open' } },
      ],
    };
    const scores = {
      'o/r#1': score({ urgency: 'critical', value: 'must-have' }),
      'o/r#2': score({ urgency: 'low', value: 'questionable' }),
    };

    expect(findNextPick([blocked, buildItem(2)], scores, {})).toBe('o/r#2');
  });

  it('counts an agent score as a placing score, and skips an item that lacks an axis', () => {
    const items = [buildItem(1), buildItem(2)];
    const scores = {
      'o/r#1': score({ urgency: 'critical' }),
      'o/r#2': score({ urgency: 'low', value: 'questionable' }, 'agent'),
    };

    expect(findNextPick(items, scores, {})).toBe('o/r#2');
  });

  it('returns undefined when no open item is placed', () => {
    const closed: WorkItem = { ...buildItem(1), state: 'closed' };

    expect(
      findNextPick([closed, buildItem(2)], { 'o/r#1': score({ urgency: 'critical', value: 'must-have' }) }, {}),
    ).toBeUndefined();
  });
});

// region | Helpers
function buildItem(number: number, createdAt = '2026-11-01T09:00:00Z'): WorkItem {
  return {
    repo: 'o/r',
    number,
    title: `Issue ${number}`,
    url: `https://example.test/${number}`,
    state: 'open',
    createdAt,
    labels: [],
    relations: [],
  };
}

function score(values: Scores, by: Scorer = 'author'): ItemScores {
  const scores: ItemScores = {};
  if (values.urgency !== undefined) scores.urgency = { score: values.urgency, by, at: AT };
  if (values.value !== undefined) scores.value = { score: values.value, by, at: AT };
  if (values.effort !== undefined) scores.effort = { score: values.effort, by, at: AT };
  if (values.progress !== undefined) scores.progress = { score: values.progress, by, at: AT };
  return scores;
}
// endregion | Helpers
