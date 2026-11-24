import type { GraphqlRequest } from '#src/fetch-issues.ts';

/** How the fake answers a mutation, or every request for `scope`. */
type Failure = 'mutation-refused' | 'scope';

interface FakeIssueStatusOptions {
  failure?: Failure;
  /** The repository's planning statuses in display order, as id and category key; null when unavailable. */
  statuses?: Array<{ id: string; key: string }> | null;
}

interface FakeIssueStatus {
  /** The status id set on each issue, by issue number. */
  set: Map<number, string>;
  request: GraphqlRequest;
}

/** GitHub's default planning statuses, in display order. */
export const DEFAULT_PLANNING_STATUSES = [
  { id: 'IS_backlog', key: 'backlog' },
  { id: 'IS_todo', key: 'planned' },
  { id: 'IS_in_progress', key: 'started' },
  { id: 'IS_in_review', key: 'started' },
  { id: 'IS_done', key: 'completed' },
];

/** Returns a fake GraphQL endpoint for the issues of `owner/repo`, whose node ids are `I_<number>`. */
export function createFakeIssueStatus({
  failure,
  statuses = DEFAULT_PLANNING_STATUSES,
}: FakeIssueStatusOptions = {}): FakeIssueStatus {
  const set = new Map<number, string>();

  const request: GraphqlRequest = (query, variables) => {
    if (failure === 'scope') {
      return Promise.resolve({ data: null, errors: [{ type: 'INSUFFICIENT_SCOPES', message: 'Insufficient scopes' }] });
    }
    if (query.startsWith('query')) {
      const planningStatuses =
        statuses === null ? null : { nodes: statuses.map(({ id, key }) => ({ id, category: { key } })) };
      const issue = { id: `I_${String(variables['number'])}` };
      return Promise.resolve({ data: { repository: { issue, planningStatuses } } });
    }
    if (failure === 'mutation-refused') {
      return Promise.resolve({ data: null, errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible' }] });
    }
    const number = Number(String(variables['issueId']).replace(/^I_/, ''));
    set.set(number, String(variables['statusId']));
    return Promise.resolve({ data: { setIssueStatus: { issue: { id: `I_${number}` } } } });
  };
  return { set, request };
}
