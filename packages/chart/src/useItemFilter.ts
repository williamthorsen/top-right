import {
  buildDefaultFilter,
  type Collection,
  countByStatus,
  filterItems,
  formatItemKey,
  type ItemFilter,
  type ItemRef,
  resolveShownRepos,
  type StatusCategory,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import { useMemo, useState } from 'react';

import { type Abbreviations, labelItem } from './item-label.ts';

/** The board's filter, with the items that it keeps and the labels and counts that follow from it. */
export interface ItemFilterState {
  filter: ItemFilter;
  setFilter: (filter: ItemFilter) => void;
  /** The repositories that the filter's scope resolves to, or undefined for every repository. */
  shownRepos: ReadonlySet<string> | undefined;
  visibleItems: WorkItem[];
  visibleKeys: ReadonlySet<string>;
  /** The count of each status within the shown repositories, whatever statuses the filter keeps. */
  statusCounts: Record<StatusCategory, number>;
  /** Returns an item's label on the board: the number alone while one repo is shown, else the abbreviated id. */
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
}

/**
 * Holds the board's filter, which starts at the default collection on every mount, and derives what it keeps,
 * resolving the scope against the current `collections`.
 */
export function useItemFilter(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  abbreviations: Abbreviations,
  collections: readonly Collection[],
  defaultCollectionId: string | undefined,
): ItemFilterState {
  const [filter, setFilter] = useState<ItemFilter>(() => buildDefaultFilter(defaultCollectionId, collections));
  const shownRepos = useMemo(() => resolveShownRepos(filter.scope, collections), [filter.scope, collections]);
  const visibleItems = useMemo(
    () => filterItems(items, overrides, filter, shownRepos),
    [items, overrides, filter, shownRepos],
  );
  const visibleKeys = useMemo(() => new Set(visibleItems.map(formatItemKey)), [visibleItems]);
  const statusCounts = useMemo(() => countByStatus(items, overrides, shownRepos), [items, overrides, shownRepos]);

  return {
    filter,
    setFilter,
    shownRepos,
    visibleItems,
    visibleKeys,
    statusCounts,
    labelOf: (ref) => (shownRepos?.size === 1 ? String(ref.number) : labelItem(ref, abbreviations)),
  };
}
