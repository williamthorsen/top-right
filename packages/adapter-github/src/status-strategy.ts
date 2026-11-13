import type { ItemPatch, ItemRef, OpenStatus, WorkItem } from '@top-right/model';

import type { GraphqlRequest } from './fetch-issues.ts';
import { updateIssueLabels } from './update-issue-labels.ts';

/** The label that marks an open issue as in progress, as release-kit's common label preset defines it. */
export const IN_PROGRESS_LABEL = 'status:in-progress';

/** An open item's status as a strategy reads it, with the label that decided it when a label did. */
export type StatusReading = Pick<WorkItem, 'sourceStatusLabel'> & { sourceStatus: OpenStatus };

/** How a repository tracks whether an open item is in progress, read with its issue and written at its source. */
export interface StatusStrategy {
  /** The GraphQL fields that the issues query adds to each issue for `read`; empty when the work item suffices. */
  issueFields: string;
  /** Reads an open item's status from the item and from its issue as the query returned it. */
  read(item: WorkItem, issue: unknown): StatusReading;
  /** Writes the status at the source and resolves to the fields that changed, `sourceStatus` included. */
  write(ref: Pick<ItemRef, 'number' | 'repo'>, status: OpenStatus): Promise<ItemPatch>;
}

/** Returns the strategy that tracks In progress as the `status:in-progress` label, matched case-insensitively. */
export function createLabelStatusStrategy(request: GraphqlRequest): StatusStrategy {
  return {
    issueFields: '',
    read: (item) => readLabelStatus(item.labels),
    async write(ref, status) {
      const change =
        status === 'in-progress' ? { add: [IN_PROGRESS_LABEL], remove: [] } : { add: [], remove: [IN_PROGRESS_LABEL] };
      const labels = await updateIssueLabels(request, ref.repo, ref.number, change);
      return { labels, ...readLabelStatus(labels) };
    },
  };
}

// region | Helpers
/** Returns in-progress, with the first label that matches the in-progress label in any case, or else to-do. */
function readLabelStatus(labels: readonly string[]): StatusReading {
  const label = labels.find((candidate) => candidate.toLowerCase() === IN_PROGRESS_LABEL);
  return label === undefined ? { sourceStatus: 'to-do' } : { sourceStatus: 'in-progress', sourceStatusLabel: label };
}
// endregion | Helpers
