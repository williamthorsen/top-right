import { formatItemKey, type WorkItem } from '@top-right/model';

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
  /** Replaces an item's labels after a write, in the last read and in a read already in progress. */
  setLabels: (itemKey: string, labels: readonly string[]) => void;
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
  // A read in progress started before these writes, so its issues carry the labels from before them.
  let patches = new Map<string, readonly string[]>();

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
    patches = new Map();
    const result = { items: applyPatches(await load(), patches), readAt };
    last = result;
    return result;
  }

  function setLabels(itemKey: string, labels: readonly string[]): void {
    if (pending) patches.set(itemKey, labels);
    if (last) last = { ...last, items: applyPatches(last.items, new Map([[itemKey, labels]])) };
  }

  async function get(): Promise<CachedItems> {
    const latest = last ?? (await refresh());
    return { ...latest, isStale: now().getTime() - latest.readAt.getTime() > maxAgeMs };
  }

  return { get, refresh, setLabels };
}

// region | Helpers
/** Returns `items` with the labels of each patched item replaced. */
function applyPatches(items: readonly WorkItem[], patches: ReadonlyMap<string, readonly string[]>): WorkItem[] {
  return items.map((item) => {
    const labels = patches.get(formatItemKey(item));
    return labels ? { ...item, labels: [...labels] } : item;
  });
}
// endregion | Helpers
