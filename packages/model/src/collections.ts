/** A named group of configured repositories that the filter selects as one entry. */
export interface Collection {
  /** A stable id, so that a rename keeps the collection's place as the default. */
  id: string;
  name: string;
  /** The repositories as `owner/name`. */
  repos: readonly string[];
}

/** A user's collections, in the order in which they were added, and the collection that the filter starts at. */
export interface CollectionSettings {
  collections: readonly Collection[];
  defaultCollectionId: string | undefined;
}

/** The collections and repositories that the filter selects; an empty scope selects every repository. */
export interface RepoScope {
  collectionIds: ReadonlySet<string>;
  repos: ReadonlySet<string>;
}

/** The settings of a user who has not saved any collections. */
export const EMPTY_COLLECTION_SETTINGS: CollectionSettings = { collections: [], defaultCollectionId: undefined };

/** A scope that selects every repository. */
export const EMPTY_REPO_SCOPE: RepoScope = { collectionIds: new Set<string>(), repos: new Set<string>() };

/**
 * Returns the message that refuses the first problem in `settings`, or undefined when it has none: an empty name, a name
 * that another collection uses (trimmed, compared case-insensitively), a collection without repositories, a repository
 * outside `configuredRepos`, or a default id that does not name any collection.
 */
export function findCollectionProblem(
  { collections, defaultCollectionId }: CollectionSettings,
  configuredRepos: readonly string[],
): string | undefined {
  const configured = new Set(configuredRepos);
  const seenNames = new Set<string>();
  for (const collection of collections) {
    const name = collection.name.trim();
    if (name === '') return 'Give every collection a name.';
    const key = name.toLowerCase();
    if (seenNames.has(key)) return `More than one collection is named "${name}". Give each its own name.`;
    seenNames.add(key);
    if (collection.repos.length === 0)
      return `"${name}" does not include any repository. Add one or delete the collection.`;
    const unconfigured = collection.repos.find((repo) => !configured.has(repo));
    if (unconfigured !== undefined) return `"${name}" includes ${unconfigured}, which the config does not list.`;
  }
  if (defaultCollectionId !== undefined && !collections.some((collection) => collection.id === defaultCollectionId)) {
    return 'The default collection does not exist. Choose another default.';
  }
  return undefined;
}

/**
 * Returns the union of the scope's repositories and its collections' repositories, or undefined for every repository
 * when the scope is empty. An id that does not name any collection contributes nothing.
 */
export function resolveShownRepos(
  scope: RepoScope,
  collections: readonly Collection[],
): ReadonlySet<string> | undefined {
  if (scope.collectionIds.size === 0 && scope.repos.size === 0) return undefined;
  const shown = new Set(scope.repos);
  for (const collection of collections) {
    if (!scope.collectionIds.has(collection.id)) continue;
    for (const repo of collection.repos) shown.add(repo);
  }
  return shown;
}
