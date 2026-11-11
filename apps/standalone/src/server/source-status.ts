import type { StatusStrategy } from '@top-right/adapter-github';
import type { WorkItem } from '@top-right/model';

/**
 * Returns `items` with each open item's status as its repository's strategy reads it. A closed item, and an item whose
 * repository lacks a strategy, keeps `sourceStatus` unset.
 */
export function applySourceStatus(
  items: readonly WorkItem[],
  strategyFor: (repo: string) => StatusStrategy | undefined,
): WorkItem[] {
  return items.map((item) => {
    if (item.state !== 'open') return item;
    const strategy = strategyFor(item.repo);
    return strategy ? { ...item, sourceStatus: strategy.read(item) } : item;
  });
}
