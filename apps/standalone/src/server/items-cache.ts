import type { WorkItem } from '@top-right/model';

/** How long the last read's issues stay fresh before a load reports them as stale. */
export const MAX_ITEMS_AGE_MS = 60_000;

/** The issues of one successful read, with when the read started. */
export interface ItemsRead {
  items: WorkItem[];
  readAt: Date;
}

/** The last read's issues, as a load serves them. */
export interface CachedItems extends ItemsRead {
  /** Whether the issues are older than the cache's maximum age. */
  isStale: boolean;
}

/** The host's copy of the issues that it last read from their source. */
export interface ItemsCache {
  /** Returns the last read's issues, waiting for a read when none has finished. */
  get: () => Promise<CachedItems>;
  /** Reads the issues afresh, sharing a read in progress; a failed read keeps the last issues. */
  refresh: () => Promise<ItemsRead>;
}

export interface ItemsCacheOptions {
  load: () => Promise<WorkItem[]>;
  maxAgeMs?: number;
  now?: () => Date;
}

/** Returns a cache that keeps the issues of its last successful read and shares one read among concurrent callers. */
export function createItemsCache({
  load,
  maxAgeMs = MAX_ITEMS_AGE_MS,
  now = () => new Date(),
}: ItemsCacheOptions): ItemsCache {
  let last: ItemsRead | undefined;
  let pending: Promise<ItemsRead> | undefined;

  function refresh(): Promise<ItemsRead> {
    pending ??= (async () => {
      const readAt = now();
      try {
        const read = { items: await load(), readAt };
        last = read;
        return read;
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }

  async function get(): Promise<CachedItems> {
    const read = last ?? (await refresh());
    return { ...read, isStale: now().getTime() - read.readAt.getTime() > maxAgeMs };
  }

  return { get, refresh };
}
