import { formatItemKey, type WorkItem } from '@top-right/model';

import { type GitHubIssue, issuesResponseSchema, mapIssue } from './map-issue.ts';
import { buildIssuesQuery } from './query.ts';
import type { StatusStrategy } from './status-strategy.ts';

/** Sends a GraphQL query to GitHub and resolves to the response body; the host supplies it with its credentials. */
export type GraphqlRequest = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

/** A failure to read a repository's issues, naming the repository. */
export class GitHubAdapterError extends Error {
  override name = 'GitHubAdapterError';
}

/** A resource that GitHub does not return, either because it does not exist or because the token cannot read it. */
export class GitHubNotFoundError extends GitHubAdapterError {
  override name = 'GitHubNotFoundError';
}

/** A refusal because the token lacks a scope that the request needs. */
export class GitHubScopeError extends GitHubAdapterError {
  override name = 'GitHubScopeError';
}

/** Which issues to read beyond the open ones, and how to read an open issue's status. */
export interface FetchIssuesOptions {
  /** Also reads the issues closed at or after this moment; without it, no closed issue is read. */
  closedSince?: Date | undefined;
  /** Reads each open issue's `sourceStatus`; without it, the status stays unset. */
  status?: StatusStrategy | undefined;
}

const DEFAULT_PAGE_SIZE = 100;

/**
 * Reads the open issues of `repo` (`owner/name`), and those closed since `closedSince`, as work items, with each open
 * item's status as `status` reads it.
 */
export async function fetchIssues(
  request: GraphqlRequest,
  repo: string,
  { closedSince, pageSize = DEFAULT_PAGE_SIZE, status }: FetchIssuesOptions & { pageSize?: number } = {},
): Promise<WorkItem[]> {
  const [owner, name, extra] = repo.split('/', 3);
  if (!owner || !name || extra !== undefined)
    throw new GitHubAdapterError(`${repo}: expected a repository as owner/name`);

  function read(variables: Record<string, unknown>): Promise<GitHubIssue[]> {
    return readAllPages(request, repo, buildIssuesQuery(status?.issueFields), { owner, name, pageSize, ...variables });
  }
  const open = await read({ states: ['OPEN'], orderBy: { field: 'CREATED_AT', direction: 'ASC' } });
  // `since` filters on the update time, which closing an issue advances, so the closed time decides membership.
  const closed =
    closedSince === undefined
      ? []
      : (
          await read({
            states: ['CLOSED'],
            orderBy: { field: 'UPDATED_AT', direction: 'DESC' },
            filterBy: { since: closedSince.toISOString() },
          })
        ).filter((issue) => issue.closedAt !== null && Date.parse(issue.closedAt) >= closedSince.getTime());

  const items = new Map<string, WorkItem>();
  for (const issue of [...open, ...closed]) {
    const mapped = mapIssue(issue, repo);
    const item = status && mapped.state === 'open' ? { ...mapped, sourceStatus: status.read(mapped, issue) } : mapped;
    // An issue whose state changes between the two reads appears in both; the first record stands.
    const key = formatItemKey(item);
    if (!items.has(key)) items.set(key, item);
  }
  return items.values().toArray();
}

/** Reads the issues of every repository, each with its repository's status strategy; any failure rejects the whole read. */
export async function fetchIssuesOfRepos(
  request: GraphqlRequest,
  repos: readonly string[],
  {
    closedSince,
    strategyFor,
  }: Pick<FetchIssuesOptions, 'closedSince'> & { strategyFor?: (repo: string) => StatusStrategy | undefined } = {},
): Promise<WorkItem[]> {
  const perRepo = await Promise.all(
    repos.map((repo) => fetchIssues(request, repo, { closedSince, status: strategyFor?.(repo) })),
  );
  return perRepo.flat();
}

// region | Helpers
/** Reads every page of `query` for the variables, following the end cursor. */
async function readAllPages(
  request: GraphqlRequest,
  repo: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let after: string | null = null;
  do {
    const parsed = issuesResponseSchema.safeParse(await request(query, { ...variables, after }));
    if (!parsed.success)
      throw new GitHubAdapterError(`${repo}: unexpected response from GitHub`, { cause: parsed.error });
    const { data, errors } = parsed.data;
    if (errors?.length) throw new GitHubAdapterError(`${repo}: ${errors.map((error) => error.message).join('; ')}`);
    const page = data?.repository?.issues;
    if (!page) throw new GitHubAdapterError(`${repo}: repository not found, or the token cannot read it`);

    issues.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return issues;
}
// endregion | Helpers
