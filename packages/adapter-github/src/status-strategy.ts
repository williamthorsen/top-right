import type { ItemPatch, ItemRef, OpenStatus, WorkItem } from '@top-right/model';

/** An open item's status as a strategy reads it. */
export interface StatusReading {
  sourceStatus: OpenStatus;
}

/** How a repository tracks an open item's status, read with its issue and written at its source. */
export interface StatusStrategy {
  /** The GraphQL fields that the issues query adds to each issue for `read`; empty when the work item suffices. */
  issueFields: string;
  /** Returns true when an open item is not to be loaded, judged as `read` judges its status; absent, none is hidden. */
  hides?(item: WorkItem, issue: unknown): boolean;
  /** Reads an open item's status from the item and from its issue as the query returned it. */
  read(item: WorkItem, issue: unknown): StatusReading;
  /** Writes the status at the source and resolves to the fields that changed, `sourceStatus` included. */
  write(ref: Pick<ItemRef, 'number' | 'repo'>, status: OpenStatus): Promise<ItemPatch>;
}
