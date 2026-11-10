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
      try {
        // `read` is async, so even a `load` that throws at once suspends here, and the `finally` runs after `??=`.
        return await read();
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }

  /** Reads the issues and keeps them as the last read. */
  async function read(): Promise<ItemsRead> {
    const readAt = now();
    const result = { items: await load(), readAt };
    last = result;
    return result;
  }

  async function get(): Promise<CachedItems> {
    const latest = last ?? (await refresh());
    return { ...latest, isStale: now().getTime() - latest.readAt.getTime() > maxAgeMs };
  }

  return { get, refresh };
}
