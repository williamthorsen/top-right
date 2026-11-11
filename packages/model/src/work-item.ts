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
  /** When the item was created at its source, as an ISO timestamp. */
  createdAt: string;
  labels: string[];
  relations: Relation[];
  /** The open item's status where its source tracks one; unset when the source does not. */
  sourceStatus?: 'in-progress' | 'to-do';
}

/** The fields of an item that a write at its source can change, as a write reports them. */
export type ItemPatch = Partial<Pick<WorkItem, 'labels' | 'sourceStatus'>>;

/** Returns a key that identifies an item across repositories, as `owner/name#number`. */
export function formatItemKey(ref: Pick<ItemRef, 'number' | 'repo'>): string {
  return `${ref.repo}#${ref.number}`;
}

/** Returns the repository and number that an item key names, or `undefined` when it is not `owner/name#number`. */
export function parseItemKey(itemKey: string): Pick<ItemRef, 'number' | 'repo'> | undefined {
  const match = /^([^/#\s]+\/[^/#\s]+)#([1-9]\d*)$/.exec(itemKey);
  if (!match?.[1] || !match[2]) return undefined;
  return { repo: match[1], number: Number(match[2]) };
}
