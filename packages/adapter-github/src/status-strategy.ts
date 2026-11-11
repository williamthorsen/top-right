import type { ItemPatch, ItemRef, WorkItem } from '@top-right/model';

import type { GraphqlRequest } from './fetch-issues.ts';
import { updateIssueLabels } from './update-issue-labels.ts';

/** The label that marks an open issue as in progress, as release-kit's common label preset defines it. */
export const IN_PROGRESS_LABEL = 'status:in-progress';

/** How a repository tracks whether an open item is in progress, read from the item and written at its source. */
export interface StatusStrategy {
  /** Reads an open item's status at its source. */
  read(item: WorkItem): 'in-progress' | 'to-do';
  /** Writes the status at the source and resolves to the fields that changed, `sourceStatus` included. */
  write(ref: Pick<ItemRef, 'number' | 'repo'>, status: 'in-progress' | 'to-do'): Promise<ItemPatch>;
}

/** Returns the strategy that tracks In progress as the `status:in-progress` label, matched case-insensitively. */
export function createLabelStatusStrategy(request: GraphqlRequest): StatusStrategy {
  return {
    read: (item) => readLabelStatus(item.labels),
    async write(ref, status) {
      const change =
        status === 'in-progress' ? { add: [IN_PROGRESS_LABEL], remove: [] } : { add: [], remove: [IN_PROGRESS_LABEL] };
      const labels = await updateIssueLabels(request, ref.repo, ref.number, change);
      return { labels, sourceStatus: readLabelStatus(labels) };
    },
  };
}

// region | Helpers
/** Returns in-progress when the labels include the in-progress label in any case, and to-do otherwise. */
function readLabelStatus(labels: readonly string[]): 'in-progress' | 'to-do' {
  return labels.some((label) => label.toLowerCase() === IN_PROGRESS_LABEL) ? 'in-progress' : 'to-do';
}
// endregion | Helpers
