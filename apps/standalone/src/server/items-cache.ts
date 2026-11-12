import { formatItemKey, type ItemPatch, parseItemKey, type WorkItem } from '@top-right/model';

/** How long a repository's last read stays fresh before a load reports it as stale. */
export const MAX_ITEMS_AGE_MS = 60_000;

/** When a repository's issues were last read, and whether that read is older than the cache's maximum age. */
export interface RepoRead {
  readAt: Date;
  isStale: boolean;
}

/** The issues of the requested repositories, with each repository's read. */
export interface ItemsRead {
  items: WorkItem[];
  reads: Record<string, RepoRead>;
}

/** The host's copy of the issues that it last read from their source, kept per repository. */
export interface ItemsCache {
  /** Returns the last reads of `repos`, waiting only for the repositories that have not been read. */
  get: (repos: readonly string[]) => Promise<ItemsRead>;
  /** Reads `repos` afresh, sharing a read in progress; a repository whose read fails keeps its last issues. */
  refresh: (repos: readonly string[]) => Promise<ItemsRead>;
  /** Replaces the fields that a write changed on an item, in its repository's last read and in a read in progress. */
  patchItem: (itemKey: string, patch: ItemPatch) => void;
}

export interface ItemsCacheOptions {
  loadRepo: (repo: string) => Promise<WorkItem[]>;
  maxAgeMs?: number;
  now?: () => Date;
}

/** One successful read of one repository's issues. */
interface StoredRead {
  items: WorkItem[];
  readAt: Date;
}

/**
 * Returns a cache that keeps each repository's last successful read and shares one read of a repository among
 * concurrent callers.
 */
export function createItemsCache({
  loadRepo,
  maxAgeMs = MAX_ITEMS_AGE_MS,
  now = () => new Date(),
}: ItemsCacheOptions): ItemsCache {
  const last = new Map<string, StoredRead>();
  const pending = new Map<string, Promise<StoredRead>>();
  // A read in progress started before these writes, so its issues carry the fields from before them.
  const patches = new Map<string, Map<string, ItemPatch>>();

  function refreshRepo(repo: string): Promise<StoredRead> {
    const inProgress = pending.get(repo);
    if (inProgress) return inProgress;
    const started = (async () => {
      try {
        // `read` is async, so even a `loadRepo` that throws at once suspends here, and the `finally` runs after `set`.
        return await read(repo);
      } finally {
        pending.delete(repo);
        patches.delete(repo);
      }
    })();
    pending.set(repo, started);
    return started;
  }

  /** Reads one repository's issues and keeps them as its last read. */
  async function read(repo: string): Promise<StoredRead> {
    const readAt = now();
    const repoPatches = new Map<string, ItemPatch>();
    patches.set(repo, repoPatches);
    const result = { items: applyPatches(await loadRepo(repo), repoPatches), readAt };
    last.set(repo, result);
    return result;
  }

  /** Combines the reads of `repos`, in their order, judging each read's age now. */
  async function collect(repos: readonly string[], readRepo: (repo: string) => Promise<StoredRead>) {
    const stored = await Promise.all(repos.map(async (repo) => ({ repo, ...(await readRepo(repo)) })));
    const time = now().getTime();
    const reads: Record<string, RepoRead> = {};
    for (const { repo, readAt } of stored) reads[repo] = { readAt, isStale: time - readAt.getTime() > maxAgeMs };
    return { items: stored.flatMap((entry) => entry.items), reads };
  }

  function patchItem(itemKey: string, patch: ItemPatch): void {
    const repo = parseItemKey(itemKey)?.repo;
    if (repo === undefined) return;
    const repoPatches = patches.get(repo);
    if (repoPatches) repoPatches.set(itemKey, { ...repoPatches.get(itemKey), ...patch });
    const stored = last.get(repo);
    if (stored) last.set(repo, { ...stored, items: applyPatches(stored.items, new Map([[itemKey, patch]])) });
  }

  return {
    get: (repos) => collect(repos, (repo) => Promise.resolve(last.get(repo) ?? refreshRepo(repo))),
    patchItem,
    refresh: (repos) => collect(repos, refreshRepo),
  };
}

// region | Helpers
/** Returns `items` with the fields that each patch names replaced on its item. */
function applyPatches(items: readonly WorkItem[], patches: ReadonlyMap<string, ItemPatch>): WorkItem[] {
  return items.map((item) => {
    const patch = patches.get(formatItemKey(item));
    return patch ? { ...item, ...patch } : item;
  });
}
// endregion | Helpers
