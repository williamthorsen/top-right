/** An item's state at its source. */
export type ItemState = 'closed' | 'open';

/** A reference to an item at its source, enough to label and link it. */
export interface ItemRef {
  /** The repository as `owner/name`. */
  repo: string;
  number: number;
  title: string;
  url: string;
  state: ItemState;
}

/** How a related item relates to the item that lists it. */
export type RelationKind = 'blocked-by' | 'blocking' | 'parent' | 'sub-issue';

export interface Relation {
  kind: RelationKind;
  ref: ItemRef;
}

/** A work item read from a source, with its labels and relations. */
export interface WorkItem extends ItemRef {
  labels: string[];
  relations: Relation[];
}

/** Returns a key that identifies an item across repositories, as `owner/name#number`. */
export function formatItemKey(ref: Pick<ItemRef, 'number' | 'repo'>): string {
  return `${ref.repo}#${ref.number}`;
}
