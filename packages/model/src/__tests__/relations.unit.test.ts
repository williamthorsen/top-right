import { describe, expect, it } from 'vitest';

import { buildRelationGraph, findLongestBlockerChain, isBlocked, listBlockedKeys } from '../relations.ts';
import type { ItemRef, Relation, RelationKind, WorkItem } from '../work-item.ts';

const REPO = 'o/r';

describe(buildRelationGraph, () => {
  it('lists a relation once when both of its items list it', () => {
    const items = [
      buildItem(1, [relate('blocking', 2)]),
      buildItem(2, [relate('blocked-by', 1), relate('parent', 3)]),
      buildItem(3, [relate('sub-issue', 2)]),
    ];

    expect(buildRelationGraph(items).edges).toStrictEqual([
      { kind: 'blocker', from: 'o/r#1', to: 'o/r#2' },
      { kind: 'sub-issue', from: 'o/r#2', to: 'o/r#3' },
    ]);
  });

  it('omits an edge whose other item is not loaded', () => {
    const items = [buildItem(1, [relate('blocked-by', 9), relate('parent', 8)])];

    expect(buildRelationGraph(items).edges).toStrictEqual([]);
  });

  it('walks the blocker chain upstream and downstream, ignoring sub-issue edges', () => {
    const items = [
      buildItem(1, [relate('blocking', 2)]),
      buildItem(2, [relate('blocking', 3), relate('parent', 5)]),
      buildItem(3, [relate('blocking', 4)]),
      buildItem(4),
      buildItem(5),
    ];

    const chain = buildRelationGraph(items).findBlockerChain('o/r#2');

    expect(chain).toStrictEqual({ upstream: new Set(['o/r#1']), downstream: new Set(['o/r#3', 'o/r#4']) });
  });

  it('ends a walk around a blocker cycle, leaving the start out of the chain', () => {
    const items = [
      buildItem(1, [relate('blocking', 2)]),
      buildItem(2, [relate('blocking', 3)]),
      buildItem(3, [relate('blocking', 1)]),
    ];

    const chain = buildRelationGraph(items).findBlockerChain('o/r#1');

    expect(chain).toStrictEqual({
      upstream: new Set(['o/r#3', 'o/r#2']),
      downstream: new Set(['o/r#2', 'o/r#3']),
    });
  });
});

describe(findLongestBlockerChain, () => {
  it('returns a linear chain from the first blocker to the last blocked item', () => {
    const items = [buildItem(3, [relate('blocked-by', 2)]), buildItem(2, [relate('blocked-by', 1)]), buildItem(1)];

    expect(findLongestBlockerChain(items)).toStrictEqual(['o/r#1', 'o/r#2', 'o/r#3']);
  });

  it('takes the longer branch, ignoring sub-issue edges', () => {
    const items = [
      buildItem(1, [relate('blocking', 2), relate('blocking', 5)]),
      buildItem(2, [relate('blocking', 3)]),
      buildItem(3, [relate('blocking', 4)]),
      buildItem(4),
      buildItem(5, [relate('sub-issue', 6)]),
      buildItem(6, [relate('sub-issue', 7)]),
      buildItem(7),
    ];

    expect(findLongestBlockerChain(items)).toStrictEqual(['o/r#1', 'o/r#2', 'o/r#3', 'o/r#4']);
  });

  it('breaks a tie by the keys that sort first, whatever the input order', () => {
    const items = [
      buildItem(7, [relate('blocking', 8)]),
      buildItem(8),
      buildItem(1, [relate('blocking', 3)]),
      buildItem(3),
      buildItem(2, [relate('blocking', 9)]),
      buildItem(9),
    ];

    expect(findLongestBlockerChain(items)).toStrictEqual(['o/r#1', 'o/r#3']);
    expect(findLongestBlockerChain(items.toReversed())).toStrictEqual(['o/r#1', 'o/r#3']);
  });

  it('ends on a blocker cycle and names each item once', () => {
    const items = [
      buildItem(1, [relate('blocking', 2)]),
      buildItem(2, [relate('blocking', 3)]),
      buildItem(3, [relate('blocking', 1)]),
      buildItem(4, [relate('blocking', 1)]),
    ];

    const chain = findLongestBlockerChain(items);

    expect(chain).toHaveLength(4);
    expect(new Set(chain).size).toBe(4);
  });

  it('breaks a chain at a closed item', () => {
    const items = [
      buildItem(1, [relate('blocking', 2)]),
      buildItem(2, [relate('blocking', 3)], 'closed'),
      buildItem(3, [relate('blocking', 4)]),
      buildItem(4),
    ];

    expect(findLongestBlockerChain(items)).toStrictEqual(['o/r#3', 'o/r#4']);
  });

  it('returns no chain without a blocker edge between loaded items', () => {
    const items = [buildItem(1, [relate('blocked-by', 9)]), buildItem(2, [relate('parent', 1)])];

    expect(findLongestBlockerChain(items)).toStrictEqual([]);
  });
});

describe(isBlocked, () => {
  it('holds for an open blocker, loaded or not, and not for a closed one', () => {
    expect(isBlocked(buildItem(1, [relate('blocked-by', 9)]))).toBe(true);
    expect(isBlocked(buildItem(1, [relate('blocked-by', 9, 'closed')]))).toBe(false);
    expect(isBlocked(buildItem(1, [relate('blocking', 9)]))).toBe(false);
  });
});

describe(listBlockedKeys, () => {
  it('returns the keys of the blocked items', () => {
    const items = [buildItem(1, [relate('blocked-by', 2)]), buildItem(2)];

    expect(listBlockedKeys(items)).toStrictEqual(new Set(['o/r#1']));
  });
});

// region | Helpers
function buildItem(number: number, relations: Relation[] = [], state: ItemRef['state'] = 'open'): WorkItem {
  return { ...buildRef(number, state), createdAt: '2026-11-01T09:00:00Z', labels: [], relations };
}

function buildRef(number: number, state: ItemRef['state'] = 'open'): ItemRef {
  return { repo: REPO, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state };
}

function relate(kind: RelationKind, number: number, state: ItemRef['state'] = 'open'): Relation {
  return { kind, ref: buildRef(number, state) };
}
// endregion | Helpers
