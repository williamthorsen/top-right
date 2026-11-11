import type { StatusStrategy } from '@top-right/adapter-github';
import type { ItemPatch, ItemRef } from '@top-right/model';
import type { Store } from '@top-right/store';

import { describeError } from './http-json.ts';
import type { ItemsCache } from './items-cache.ts';

/** What a host needs to write an item's status at its source. */
export interface StatusWriteContext {
  items: ItemsCache;
  store: Store;
  userId: string;
}

/**
 * Writes an open item's status through its repository's strategy, deletes the item's stored override, and returns the
 * HTTP answer. A write that the source refuses leaves the cache and the store untouched.
 */
export async function writeStatusAtSource(
  { items, store, userId }: StatusWriteContext,
  strategy: StatusStrategy,
  ref: Pick<ItemRef, 'number' | 'repo'>,
  itemKey: string,
  status: 'in-progress' | 'to-do',
): Promise<{ status: number; body: unknown }> {
  let patch: ItemPatch;
  try {
    patch = await strategy.write(ref, status);
  } catch (error) {
    return { status: 502, body: { error: describeError(error) } };
  }
  items.patchItem(itemKey, patch);
  try {
    await store.writeStatusOverride(userId, itemKey, undefined);
  } catch (error) {
    const reason = describeError(error);
    return {
      status: 500,
      body: { error: `the status changed at GitHub, but the stored status was not cleared: ${reason}`, ...patch },
    };
  }
  return { status: 200, body: { itemKey, override: null, ...patch } };
}
