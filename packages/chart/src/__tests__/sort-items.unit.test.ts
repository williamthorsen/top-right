import { deriveStatus, formatItemKey, type ItemScores, type StatusOverride, type WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { type ItemSort, type SortContext, sortItems } from '../sort-items.ts';
import { buildItem, place } from '../test-utils/chart-fixtures.tsx';

const AT = '2026-11-08T00:00:00.000Z';

describe(sortItems, () => {
  it('sorts status by to do, in progress, done, not alphabetically', () => {
    const items = [buildItem({ number: 1, state: 'closed' }), buildItem({ number: 2 }), buildItem({ number: 3 })];
    const overrides = { [key(items, 2)]: inProgress() };

    expect(numbers(sortItems(items, ascending('status'), buildContext({}, overrides)))).toEqual([2, 3, 1]);
    expect(numbers(sortItems(items, descending('status'), buildContext({}, overrides)))).toEqual([1, 3, 2]);
  });

  it.each(['urgency', 'value'] as const)('sorts %s by rank, not alphabetically', (column) => {
    const items = [buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })];
    const scores = { [key(items, 0)]: place(3, 4), [key(items, 1)]: place(1, 1), [key(items, 2)]: place(2, 2) };

    expect(numbers(sortItems(items, ascending(column), buildContext(scores)))).toEqual([2, 3, 1]);
  });

  it('sorts an unscored item last in either direction', () => {
    const items = [buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })];
    const scores = { [key(items, 1)]: place(2, 1), [key(items, 2)]: place(4, 1) };

    expect(numbers(sortItems(items, ascending('urgency'), buildContext(scores)))).toEqual([2, 3, 1]);
    expect(numbers(sortItems(items, descending('urgency'), buildContext(scores)))).toEqual([3, 2, 1]);
  });

  it('sorts the ID by repo, then by number, since numbers do not compare across repos', () => {
    const items = [
      buildItem({ number: 10, repo: 'o/b' }),
      buildItem({ number: 9, repo: 'o/a' }),
      buildItem({ number: 2, repo: 'o/b' }),
    ];

    expect(sortItems(items, ascending('id'), buildContext()).map(formatItemKey)).toEqual(['o/a#9', 'o/b#2', 'o/b#10']);
  });

  it('sorts titles ignoring case and keeps the order of items that compare equal', () => {
    const items = [
      buildItem({ number: 1, title: 'beta' }),
      buildItem({ number: 2, title: 'Alpha' }),
      buildItem({ number: 3, title: 'alpha' }),
    ];

    expect(numbers(sortItems(items, ascending('title'), buildContext()))).toEqual([2, 3, 1]);
  });
});

// region | Helpers
function ascending(column: ItemSort['column']): ItemSort {
  return { column, direction: 'ascending' };
}

function buildContext(
  scores: Record<string, ItemScores> = {},
  overrides: Record<string, StatusOverride> = {},
): SortContext {
  return {
    scores,
    keyOf: formatItemKey,
    statusOf: (item) => deriveStatus(item, overrides[formatItemKey(item)]),
    typeNameOf: () => 'Feature',
  };
}

function descending(column: ItemSort['column']): ItemSort {
  return { column, direction: 'descending' };
}

function inProgress(): StatusOverride {
  return { status: 'in-progress', sourceState: 'open', at: AT };
}

/** Returns the key of the item at `index`. */
function key(items: WorkItem[], index: number): string {
  const item = items[index];
  if (!item) throw new Error(`No item at ${index}`);
  return formatItemKey(item);
}

function numbers(items: WorkItem[]): number[] {
  return items.map((item) => item.number);
}
// endregion | Helpers
