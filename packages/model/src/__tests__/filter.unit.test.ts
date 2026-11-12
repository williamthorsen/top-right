import { describe, expect, it } from 'vitest';

import { type Collection, EMPTY_REPO_SCOPE } from '../collections.ts';
import { buildDefaultFilter, countByStatus, filterItems, type ItemFilter, revealItem } from '../filter.ts';
import type { StatusCategory, StatusOverride } from '../status.ts';
import type { ItemState, WorkItem } from '../work-item.ts';

const AT = '2026-11-08T09:00:00.000Z';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: AT };
const DEFAULT_FILTER = buildDefaultFilter(undefined, []);

describe(buildDefaultFilter, () => {
  const collections: Collection[] = [{ id: 'c1', name: 'Core', repos: ['o/a'] }];

  it('selects the default collection when it exists', () => {
    expect(buildDefaultFilter('c1', collections)).toEqual({
      revealedKeys: new Set(),
      scope: { collectionIds: new Set(['c1']), repos: new Set() },
      statuses: new Set(['in-progress', 'to-do']),
    });
  });

  it('selects every repo without a default', () => {
    expect(buildDefaultFilter(undefined, collections).scope).toEqual(EMPTY_REPO_SCOPE);
  });

  it('selects every repo when the default names an unknown collection', () => {
    expect(buildDefaultFilter('gone', collections).scope).toEqual(EMPTY_REPO_SCOPE);
  });
});

describe(filterItems, () => {
  it('keeps only the items of the shown repos', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2), buildItem('o/c', 3)];

    expect(filterItems(items, {}, DEFAULT_FILTER, new Set(['o/b', 'o/c'])).map((item) => item.number)).toEqual([2, 3]);
  });

  it('keeps every repo when the shown repos are undefined', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2)];

    expect(filterItems(items, {}, DEFAULT_FILTER, undefined)).toHaveLength(2);
  });

  it('keeps nothing when the shown repos are empty', () => {
    expect(filterItems([buildItem('o/a', 1)], {}, DEFAULT_FILTER, new Set())).toEqual([]);
  });

  it('reads the status through the override', () => {
    const items = [buildItem('o/a', 1), buildItem('o/a', 2)];
    const filter = buildFilter(['to-do']);

    expect(filterItems(items, { 'o/a#2': IN_PROGRESS }, filter, undefined).map((item) => item.number)).toEqual([1]);
  });

  it('excludes a closed item under the default filter, whatever its override', () => {
    const items = [buildItem('o/a', 1, 'closed')];

    expect(filterItems(items, { 'o/a#1': IN_PROGRESS }, DEFAULT_FILTER, undefined)).toEqual([]);
  });

  it('keeps a revealed item whatever its status or repo, and only that one', () => {
    const items = [buildItem('o/a', 1, 'closed'), buildItem('o/a', 2, 'closed'), buildItem('o/b', 3)];
    const filter: ItemFilter = { ...DEFAULT_FILTER, revealedKeys: new Set(['o/a#1']) };

    expect(filterItems(items, {}, filter, new Set(['o/b'])).map((item) => item.number)).toEqual([1, 3]);
  });
});

describe(countByStatus, () => {
  it('counts each status within the shown repos, closed items as done', () => {
    const items = [buildItem('o/a', 1), buildItem('o/a', 2), buildItem('o/a', 3, 'closed'), buildItem('o/b', 4)];

    expect(countByStatus(items, { 'o/a#2': IN_PROGRESS }, new Set(['o/a']))).toEqual({
      done: 1,
      'in-progress': 1,
      'to-do': 1,
    });
  });

  it('counts every repo when the shown repos are undefined', () => {
    const items = [buildItem('o/a', 1), buildItem('o/b', 2)];

    expect(countByStatus(items, {}, undefined)).toEqual({ done: 0, 'in-progress': 0, 'to-do': 2 });
  });
});

describe(revealItem, () => {
  it('returns the filter itself when it already keeps the item', () => {
    const filter = buildFilter(['to-do']);

    expect(revealItem(filter, buildItem('o/a', 1), undefined, undefined)).toBe(filter);
  });

  it("adds the item's status when the filter hides it", () => {
    const revealed = revealItem(DEFAULT_FILTER, buildItem('o/a', 1, 'closed'), undefined, undefined);

    expect(revealed).toEqual({ ...DEFAULT_FILTER, statuses: new Set(['done', 'in-progress', 'to-do']) });
  });

  it("adds the item's repo to the scope when the shown repos leave it out", () => {
    const filter: ItemFilter = {
      ...DEFAULT_FILTER,
      scope: { collectionIds: new Set(['c1']), repos: new Set(['o/b']) },
    };

    const revealed = revealItem(filter, buildItem('o/a', 1), undefined, new Set(['o/b', 'o/c']));

    expect(revealed.scope).toEqual({ collectionIds: new Set(['c1']), repos: new Set(['o/b', 'o/a']) });
    expect(revealed.statuses).toEqual(DEFAULT_FILTER.statuses);
  });

  it('widens both when both hide the item, reading the status through the override', () => {
    const filter: ItemFilter = {
      ...buildFilter(['to-do']),
      scope: { collectionIds: new Set(), repos: new Set(['o/b']) },
    };

    const revealed = revealItem(filter, buildItem('o/a', 1), IN_PROGRESS, new Set(['o/b']));

    expect(revealed).toEqual({
      revealedKeys: new Set(),
      scope: { collectionIds: new Set(), repos: new Set(['o/b', 'o/a']) },
      statuses: new Set(['in-progress', 'to-do']),
    });
  });
});

// region | Helpers
function buildFilter(statuses: StatusCategory[]): ItemFilter {
  return { revealedKeys: new Set(), scope: EMPTY_REPO_SCOPE, statuses: new Set(statuses) };
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
