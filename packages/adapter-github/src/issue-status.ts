import type { OpenStatus, WorkItem } from '@top-right/model';
import { z } from 'zod';

import { GitHubAdapterError, type GraphqlRequest } from './fetch-issues.ts';
import { sendStrictRequest } from './graphql-helpers.ts';
import type { StatusStrategy } from './status-strategy.ts';

/** The most planning statuses that a write reads per repository; GitHub's default set has seven. */
const PLANNING_STATUS_LIMIT = 50;

/** The status category that each open status writes; the repository's first status of the category is set. */
const TARGET_CATEGORY: Record<OpenStatus, string> = {
  backlog: 'backlog',
  'in-progress': 'started',
  'to-do': 'planned',
};

/**
 * Returns the strategy that reads an open item's status from GitHub's native issue status and writes it there. An open
 * issue in the `started` category is In progress, one in the `backlog` category or without a status is Backlog, and any
 * other is To do.
 */
export function createIssueStatusStrategy(request: GraphqlRequest): StatusStrategy {
  return {
    issueFields: 'status { category { key } }',
    read: (item, issue) => ({ sourceStatus: readOpenStatus(readCategoryKey(item, issue)) }),
    async write(ref, status) {
      const key = `${ref.repo}#${ref.number}`;
      const [owner, name] = ref.repo.split('/', 2);
      const data = await sendStrictRequest(
        request,
        { key, need: 'issue statuses' },
        STATUSES_QUERY,
        { owner, name, number: ref.number },
        statusesSchema,
      );
      const issueId = data.repository?.issue?.id;
      if (issueId === undefined) throw new GitHubAdapterError(`${key}: issue not found`);
      const statuses = data.repository?.planningStatuses?.nodes;
      if (statuses === undefined) {
        throw new GitHubAdapterError(`${ref.repo}: issue statuses are not available in this repository`);
      }
      const category = TARGET_CATEGORY[status];
      const statusId = statuses.find((candidate) => candidate.category.key === category)?.id;
      if (statusId === undefined) {
        throw new GitHubAdapterError(`${ref.repo}: the repository has no issue status in the "${category}" category`);
      }
      await sendStrictRequest(
        request,
        { key, need: 'issue statuses' },
        SET_STATUS_MUTATION,
        { issueId, statusId },
        z.object({ setIssueStatus: z.object({ issue: z.object({ id: z.string() }) }) }),
      );
      return { sourceStatus: status };
    },
  };
}

// region | Helpers
const STATUSES_QUERY = `query IssueStatuses($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id }
    planningStatuses(first: ${PLANNING_STATUS_LIMIT}) { nodes { id category { key } } }
  }
}`;

const SET_STATUS_MUTATION = `mutation SetIssueStatus($issueId: ID!, $statusId: ID!) {
  setIssueStatus(input: { issueId: $issueId, statusId: $statusId }) { issue { id } }
}`;

const issueStatusSchema = z.object({ status: z.object({ category: z.object({ key: z.string() }) }).nullable() });

const statusesSchema = z.object({
  repository: z
    .object({
      issue: z.object({ id: z.string() }).nullable(),
      planningStatuses: z
        .object({ nodes: z.array(z.object({ id: z.string(), category: z.object({ key: z.string() }) })) })
        .nullable(),
    })
    .nullable(),
});

/** Returns the key of the issue's status category, or undefined when it has no status. */
function readCategoryKey(item: WorkItem, issue: unknown): string | undefined {
  const parsed = issueStatusSchema.safeParse(issue);
  if (!parsed.success) {
    throw new GitHubAdapterError(`${item.repo}#${item.number}: unexpected response from GitHub`, {
      cause: parsed.error,
    });
  }
  return parsed.data.status?.category.key;
}

/** Returns the open status that a status category key reads as; an issue without a status is Backlog. */
function readOpenStatus(key: string | undefined): OpenStatus {
  if (key === undefined || key === 'backlog') return 'backlog';
  return key === 'started' ? 'in-progress' : 'to-do';
}
// endregion | Helpers
