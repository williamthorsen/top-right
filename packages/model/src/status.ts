import type { ItemRef, ItemState } from './work-item.ts';

/** An item's status: the source's category, or the stored override when the override still applies. */
export type StatusCategory = 'done' | 'in-progress' | 'to-do';

/** A status that the app stores over the source's, recorded with the source state at the time it was set. */
export interface StatusOverride {
  status: 'in-progress' | 'to-do';
  sourceState: ItemState;
  /** When the override was set, as an ISO timestamp. */
  at: string;
}

/** Returns the item's status: closed at the source is done, whatever the override says. */
export function deriveStatus(item: Pick<ItemRef, 'state'>, override: StatusOverride | undefined): StatusCategory {
  if (item.state === 'closed') return 'done';
  if (override && !isOverrideVoid(item, override)) return override.status;
  return 'to-do';
}

/** Returns whether the source state has changed since the override was set, which voids it. */
export function isOverrideVoid(item: Pick<ItemRef, 'state'>, override: StatusOverride): boolean {
  return override.sourceState !== item.state;
}
