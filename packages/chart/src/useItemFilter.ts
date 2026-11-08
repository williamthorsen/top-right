import {
  countByStatus,
  DEFAULT_ITEM_FILTER,
  filterItems,
  formatItemKey,
  type ItemFilter,
  type ItemRef,
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
  visibleItems: WorkItem[];
  visibleKeys: ReadonlySet<string>;
  /** The count of each status within the repo filter, whatever statuses the filter keeps. */
  statusCounts: Record<StatusCategory, number>;
  /** Returns an item's label on the board: the number alone while one repo is shown, else the abbreviated id. */
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
}

/** Holds the board's filter, which starts at the default on every mount, and derives what it keeps. */
export function useItemFilter(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  abbreviations: Abbreviations,
): ItemFilterState {
  const [filter, setFilter] = useState<ItemFilter>(DEFAULT_ITEM_FILTER);
  const visibleItems = useMemo(() => filterItems(items, overrides, filter), [items, overrides, filter]);
  const visibleKeys = useMemo(() => new Set(visibleItems.map(formatItemKey)), [visibleItems]);
  const statusCounts = useMemo(() => countByStatus(items, overrides, filter.repo), [items, overrides, filter.repo]);

  return {
    filter,
    setFilter,
    visibleItems,
    visibleKeys,
    statusCounts,
    labelOf: (ref) => (filter.repo === undefined ? labelItem(ref, abbreviations) : String(ref.number)),
  };
}
