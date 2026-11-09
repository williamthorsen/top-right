import { describe, expect, it } from 'vitest';

import { countByStatus, DEFAULT_ITEM_FILTER, filterItems, type ItemFilter, revealItem } from '../filter.ts';
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

  it('keeps a revealed item whatever its status or repo, and only that one', () => {
    const items = [buildItem('o/a', 1, 'closed'), buildItem('o/a', 2, 'closed'), buildItem('o/b', 3)];
    const filter: ItemFilter = { ...DEFAULT_ITEM_FILTER, repo: 'o/b', revealedKeys: new Set(['o/a#1']) };

    expect(filterItems(items, {}, filter).map((item) => item.number)).toEqual([1, 3]);
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

describe(revealItem, () => {
  it('returns the filter itself when it already keeps the item', () => {
    const filter = buildFilter(['to-do']);

    expect(revealItem(filter, buildItem('o/a', 1), undefined)).toBe(filter);
  });

  it("adds the item's status when the filter hides it", () => {
    const revealed = revealItem(DEFAULT_ITEM_FILTER, buildItem('o/a', 1, 'closed'), undefined);

    expect(revealed).toEqual({
      repo: undefined,
      revealedKeys: new Set(),
      statuses: new Set(['done', 'in-progress', 'to-do']),
    });
  });

  it('clears the repo when another repo is selected', () => {
    const revealed = revealItem({ ...DEFAULT_ITEM_FILTER, repo: 'o/b' }, buildItem('o/a', 1), undefined);

    expect(revealed).toEqual({ repo: undefined, revealedKeys: new Set(), statuses: DEFAULT_ITEM_FILTER.statuses });
  });

  it('widens both when both hide the item, reading the status through the override', () => {
    const revealed = revealItem(
      { repo: 'o/b', revealedKeys: new Set(), statuses: new Set(['to-do']) },
      buildItem('o/a', 1),
      IN_PROGRESS,
    );

    expect(revealed).toEqual({ repo: undefined, revealedKeys: new Set(), statuses: new Set(['in-progress', 'to-do']) });
  });
});

// region | Helpers
function buildFilter(statuses: StatusCategory[]): ItemFilter {
  return { repo: undefined, revealedKeys: new Set(), statuses: new Set(statuses) };
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
