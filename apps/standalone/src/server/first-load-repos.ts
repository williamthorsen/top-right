import { buildDefaultFilter, type CollectionSettings, parseItemKey, resolveShownRepos } from '@top-right/model';

/**
 * Returns the configured repositories that the chart shows when it opens: the default collection's, or every one
 * without a default, plus the repository of `itemKey` when that key parses and names a configured repository.
 */
export function resolveFirstLoadRepos(
  { collections, defaultCollectionId }: CollectionSettings,
  configuredRepos: readonly string[],
  itemKey?: string,
): string[] {
  const shown = resolveShownRepos(buildDefaultFilter(defaultCollectionId, collections).scope, collections);
  const itemRepo = itemKey === undefined ? undefined : parseItemKey(itemKey)?.repo;
  return configuredRepos.filter((repo) => shown === undefined || shown.has(repo) || repo === itemRepo);
}
