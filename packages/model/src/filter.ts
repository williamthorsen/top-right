import { type Collection, EMPTY_REPO_SCOPE, type RepoScope } from './collections.ts';
import { deriveStatus, type StatusCategory, type StatusOverride } from './status.ts';
import { formatItemKey, type WorkItem } from './work-item.ts';

/** Which items the board shows: the repo scope, the statuses that stay, and the items shown whatever the rest says. */
export interface ItemFilter {
  /** The keys of items that the board shows whatever their repo or status. */
  revealedKeys: ReadonlySet<string>;
  scope: RepoScope;
  statuses: ReadonlySet<StatusCategory>;
}

/**
 * Returns the filter that the board starts at: the default collection when it exists, else every repo, with the items
 * that are to do or in progress.
 */
export function buildDefaultFilter(
  defaultCollectionId: string | undefined,
  collections: readonly Collection[],
): ItemFilter {
  const defaultCollection = collections.find((collection) => collection.id === defaultCollectionId);
  return {
    revealedKeys: new Set<string>(),
    scope: defaultCollection
      ? { collectionIds: new Set([defaultCollection.id]), repos: new Set<string>() }
      : EMPTY_REPO_SCOPE,
    statuses: new Set<StatusCategory>(['in-progress', 'to-do']),
  };
}

/**
 * Returns the count of each status among the items in `shownRepos`, or in every repo when it is undefined, whatever
 * statuses the filter keeps.
 */
export function countByStatus(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  shownRepos: ReadonlySet<string> | undefined,
): Record<StatusCategory, number> {
  const counts: Record<StatusCategory, number> = { done: 0, 'in-progress': 0, 'to-do': 0 };
  for (const item of items) {
    if (!isInRepos(item, shownRepos)) continue;
    counts[deriveStatus(item, overrides[formatItemKey(item)])] += 1;
  }
  return counts;
}

/** Returns the items that the filter keeps within `shownRepos`, the filter's resolved scope, in their original order. */
export function filterItems(
  items: readonly WorkItem[],
  overrides: Readonly<Record<string, StatusOverride>>,
  filter: ItemFilter,
  shownRepos: ReadonlySet<string> | undefined,
): WorkItem[] {
  return items.filter((item) => {
    const key = formatItemKey(item);
    return (
      filter.revealedKeys.has(key) ||
      (isInRepos(item, shownRepos) && filter.statuses.has(deriveStatus(item, overrides[key])))
    );
  });
}

/**
 * Returns a filter that keeps the item: the filter itself when it already does, else one widened by the item's status
 * and, when `shownRepos` leaves out the item's repo, by that repo.
 */
export function revealItem(
  filter: ItemFilter,
  item: WorkItem,
  override: StatusOverride | undefined,
  shownRepos: ReadonlySet<string> | undefined,
): ItemFilter {
  const status = deriveStatus(item, override);
  const isRepoKept = isInRepos(item, shownRepos);
  if (isRepoKept && filter.statuses.has(status)) return filter;
  return {
    ...filter,
    scope: isRepoKept ? filter.scope : { ...filter.scope, repos: new Set([...filter.scope.repos, item.repo]) },
    statuses: new Set([...filter.statuses, status]),
  };
}

// region | Helpers
function isInRepos(item: Pick<WorkItem, 'repo'>, repos: ReadonlySet<string> | undefined): boolean {
  return repos === undefined || repos.has(item.repo);
}
// endregion | Helpers
