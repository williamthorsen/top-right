import type { ItemState, WorkItem } from './work-item.ts';

/** An item's status: the source's category, or the stored override when the override still applies. */
export type StatusCategory = 'done' | 'in-progress' | 'to-do';

/** A status that an open item can have; Done follows only from the closed state at the source. */
export type OpenStatus = Exclude<StatusCategory, 'done'>;

/** The statuses in the order in which work moves through them, which is the order that a status sort follows. */
export const STATUS_ORDER: readonly StatusCategory[] = ['to-do', 'in-progress', 'done'];

/** A status that the app stores over the source's, recorded with the source state at the time it was set. */
export interface StatusOverride {
  status: OpenStatus;
  sourceState: ItemState;
  /** When the override was set, as an ISO timestamp. */
  at: string;
}

/**
 * Returns the item's status: closed at the source is done whatever the override says, and an override that still
 * applies outranks the source's status.
 */
export function deriveStatus(
  item: Pick<WorkItem, 'sourceStatus' | 'state'>,
  override: StatusOverride | undefined,
): StatusCategory {
  if (item.state === 'closed') return 'done';
  if (override && !isOverrideVoid(item, override)) return override.status;
  return item.sourceStatus ?? 'to-do';
}

/** Returns whether the source state has changed since the override was set, which voids it. */
export function isOverrideVoid(item: Pick<WorkItem, 'state'>, override: StatusOverride): boolean {
  return override.sourceState !== item.state;
}
