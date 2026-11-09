import { deriveStatus, type StatusCategory, type StatusOverride } from './status.ts';
import { formatItemKey, type WorkItem } from './work-item.ts';

/** Which items the board shows: one repo or all, the statuses that stay, and the items shown whatever the rest says. */
export interface ItemFilter {
  /** The repository as `owner/name`, or undefined for every repository. */
  repo: string | undefined;
  /** The keys of items that the board shows whatever their repo or status. */
  revealedKeys: ReadonlySet<string>;
  statuses: ReadonlySet<StatusCategory>;
}

/** Shows every repo's items that are to do or in progress. */
export const DEFAULT_ITEM_FILTER: ItemFilter = {
  repo: undefined,
  revealedKeys: new Set<string>(),
  statuses: new Set<StatusCategory>(['in-progress', 'to-do']),
};

/** Returns the count of each status among the items in the filter's repo, whatever statuses it keeps. */
export function countByStatus(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  repo: string | undefined,
): Record<StatusCategory, number> {
  const counts: Record<StatusCategory, number> = { done: 0, 'in-progress': 0, 'to-do': 0 };
  for (const item of items) {
    if (!isInRepo(item, repo)) continue;
    counts[deriveStatus(item, overrides[formatItemKey(item)])] += 1;
  }
  return counts;
}

/** Returns the items that the filter keeps, in their original order. */
export function filterItems(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  filter: ItemFilter,
): WorkItem[] {
  return items.filter((item) => {
    const key = formatItemKey(item);
    return (
      filter.revealedKeys.has(key) ||
      (isInRepo(item, filter.repo) && filter.statuses.has(deriveStatus(item, overrides[key])))
    );
  });
}

/**
 * Returns a filter that keeps the item: the filter itself when it already does, else one widened by the item's status
 * and, when another repo is selected, by every repo.
 */
export function revealItem(filter: ItemFilter, item: WorkItem, override: StatusOverride | undefined): ItemFilter {
  const status = deriveStatus(item, override);
  const isRepoKept = isInRepo(item, filter.repo);
  if (isRepoKept && filter.statuses.has(status)) return filter;
  return {
    ...filter,
    repo: isRepoKept ? filter.repo : undefined,
    statuses: new Set([...filter.statuses, status]),
  };
}

// region | Helpers
function isInRepo(item: Pick<WorkItem, 'repo'>, repo: string | undefined): boolean {
  return repo === undefined || item.repo === repo;
}
// endregion | Helpers
