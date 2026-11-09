import { formatItemKey, type Relation, type WorkItem } from './work-item.ts';

/** A blocker edge points from the blocking item to the blocked one; a sub-issue edge from the child to the parent. */
export type EdgeKind = 'blocker' | 'sub-issue';

/** An edge between two loaded items, by their keys. */
export interface Edge {
  kind: EdgeKind;
  from: string;
  to: string;
}

/** An item's transitive blockers (upstream) and the items that it transitively blocks (downstream), by key. */
export interface BlockerChain {
  upstream: Set<string>;
  downstream: Set<string>;
}

/** The edges among a set of items, with each item's blocker neighbours for walking chains. */
export interface RelationGraph {
  edges: Edge[];
  /** Returns the item's transitive blocker chain; safe on cycles, and the item itself is in neither set. */
  findBlockerChain: (key: string) => BlockerChain;
}

/** Builds the graph of the edges whose two ends are both among `items`, each edge once whichever side lists it. */
export function buildRelationGraph(items: readonly WorkItem[]): RelationGraph {
  const keys = new Set(items.map((item) => formatItemKey(item)));
  const edges = new Map<string, Edge>();
  for (const item of items) {
    const key = formatItemKey(item);
    for (const relation of item.relations) {
      const edge = toEdge(key, relation);
      if (keys.has(edge.from) && keys.has(edge.to) && edge.from !== edge.to) {
        edges.set(`${edge.kind}:${edge.from}:${edge.to}`, edge);
      }
    }
  }

  const blockers = new Map<string, string[]>();
  const blocked = new Map<string, string[]>();
  for (const edge of edges.values()) {
    if (edge.kind !== 'blocker') continue;
    appendTo(blocked, edge.from, edge.to);
    appendTo(blockers, edge.to, edge.from);
  }

  return {
    edges: edges.values().toArray(),
    findBlockerChain: (key) => ({ upstream: walk(key, blockers), downstream: walk(key, blocked) }),
  };
}

/**
 * Returns the keys of the longest blocker chain among the open items, from the first blocker to the last blocked item,
 * or an empty list when no chain has two items. A tie goes to the chain whose keys sort first, and an edge that would
 * close a cycle is ignored.
 */
export function findLongestBlockerChain(items: readonly WorkItem[]): string[] {
  const graph = buildRelationGraph(items.filter((item) => item.state === 'open'));
  const blocked = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind === 'blocker') appendTo(blocked, edge.from, edge.to);
  }

  const longestFrom = new Map<string, string[]>();
  const onPath = new Set<string>();
  function visit(key: string): string[] {
    const known = longestFrom.get(key);
    if (known) return known;
    onPath.add(key);
    let best: string[] = [];
    const successors = (blocked.get(key) ?? []).toSorted(compareKeys);
    for (const next of successors) {
      if (onPath.has(next)) continue;
      const path = visit(next);
      if (isLonger(path, best)) best = path;
    }
    onPath.delete(key);
    const path = [key, ...best];
    longestFrom.set(key, path);
    return path;
  }

  const starts = blocked.keys().toArray().toSorted(compareKeys);
  let chain: string[] = [];
  for (const key of starts) {
    const path = visit(key);
    if (isLonger(path, chain)) chain = path;
  }
  return chain.length >= 2 ? chain : [];
}

/** Returns whether an open item blocks the item, whether or not the blocker is loaded. */
export function isBlocked(item: Pick<WorkItem, 'relations'>): boolean {
  return item.relations.some((relation) => relation.kind === 'blocked-by' && relation.ref.state === 'open');
}

/** Returns the keys of the items that an open item blocks. */
export function listBlockedKeys(items: readonly WorkItem[]): Set<string> {
  return new Set(items.filter((item) => isBlocked(item)).map((item) => formatItemKey(item)));
}

// region | Helpers
function appendTo(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Returns whether path `a` beats path `b`: more items, or as many items with keys that sort first. */
function isLonger(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return a.length > b.length;
  for (const [index, key] of a.entries()) {
    const order = compareKeys(key, b[index] ?? '');
    if (order !== 0) return order < 0;
  }
  return false;
}

function toEdge(key: string, relation: Relation): Edge {
  const other = formatItemKey(relation.ref);
  switch (relation.kind) {
    case 'blocked-by':
      return { kind: 'blocker', from: other, to: key };
    case 'blocking':
      return { kind: 'blocker', from: key, to: other };
    case 'parent':
      return { kind: 'sub-issue', from: key, to: other };
    case 'sub-issue':
      return { kind: 'sub-issue', from: other, to: key };
  }
}

/** Returns every key reachable from `start` through `next`, without `start` itself. */
function walk(start: string, next: ReadonlyMap<string, readonly string[]>): Set<string> {
  const seen = new Set<string>();
  const pending = [...(next.get(start) ?? [])];
  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || key === start || seen.has(key)) continue;
    seen.add(key);
    pending.push(...(next.get(key) ?? []));
  }
  return seen;
}
// endregion | Helpers
