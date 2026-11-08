import { describe, expect, it } from 'vitest';

import { countByStatus, DEFAULT_ITEM_FILTER, filterItems, type ItemFilter } from '../filter.ts';
import type { StatusCategory, StatusOverride } from '../status.ts';
import type { ItemState, WorkItem } from '../work-item.ts';

const AT = '2026-11-08T09:00:00.000Z';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: AT };

describe(filterItems, () => {
  it('keeps only the items of the selected repo', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2)];

    expect(filterItems(items, {}, { ...DEFAULT_ITEM_FILTER, repo: 'o/b' }).map((item) => item.number)).toEqual([2]);
  });

  it('keeps every repo when none is selected', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2)];

    expect(filterItems(items, {}, DEFAULT_ITEM_FILTER)).toHaveLength(2);
  });

  it('reads the status through the override', () => {
    const items = [buildItem('o/a', 1), buildItem('o/a', 2)];
    const filter = buildFilter(['to-do']);

    expect(filterItems(items, { 'o/a#2': IN_PROGRESS }, filter).map((item) => item.number)).toEqual([1]);
  });

  it('excludes a closed item under the default filter, whatever its override', () => {
    const items = [buildItem('o/a', 1, 'closed')];

    expect(filterItems(items, { 'o/a#1': IN_PROGRESS }, DEFAULT_ITEM_FILTER)).toEqual([]);
  });
});

describe(countByStatus, () => {
  it('counts each status within the repo, closed items as done', () => {
    const items = [buildItem('o/a', 1), buildItem('o/a', 2), buildItem('o/a', 3, 'closed'), buildItem('o/b', 4)];

    expect(countByStatus(items, { 'o/a#2': IN_PROGRESS }, 'o/a')).toEqual({ done: 1, 'in-progress': 1, 'to-do': 1 });
  });

  it('counts every repo when none is selected', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2)];

    expect(countByStatus(items, {}, undefined)).toEqual({ done: 0, 'in-progress': 0, 'to-do': 2 });
  });
});

// region | Helpers
function buildFilter(statuses: StatusCategory[]): ItemFilter {
  return { repo: undefined, statuses: new Set(statuses) };
}

function buildItem(repo: string, number: number, state: ItemState = 'open'): WorkItem {
  return {
    repo,
    number,
    title: `Issue ${number}`,
    url: `https://example.test/${number}`,
    state,
    createdAt: '2026-11-01T09:00:00Z',
    labels: [],
    relations: [],
  };
}
// endregion | Helpers
