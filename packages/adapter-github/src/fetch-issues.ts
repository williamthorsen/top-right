import { formatItemKey, type WorkItem } from '@top-right/model';

import { type GitHubIssue, issuesResponseSchema, mapIssue } from './map-issue.ts';
import { ISSUES_QUERY } from './query.ts';

/** Sends a GraphQL query to GitHub and resolves to the response body; the host supplies it with its credentials. */
export type GraphqlRequest = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

/** A failure to read a repository's issues, naming the repository. */
export class GitHubAdapterError extends Error {
  override name = 'GitHubAdapterError';
}

/** Which issues to read beyond the open ones. */
export interface FetchIssuesOptions {
  /** Also reads the issues closed at or after this moment; without it, no closed issue is read. */
  closedSince?: Date | undefined;
}

const DEFAULT_PAGE_SIZE = 100;

/** Reads the open issues of `repo` (`owner/name`), and those closed since `closedSince`, as work items. */
export async function fetchIssues(
  request: GraphqlRequest,
  repo: string,
  { closedSince, pageSize = DEFAULT_PAGE_SIZE }: FetchIssuesOptions & { pageSize?: number } = {},
): Promise<WorkItem[]> {
  const [owner, name, extra] = repo.split('/', 3);
  if (!owner || !name || extra !== undefined)
    throw new GitHubAdapterError(`${repo}: expected a repository as owner/name`);

  function read(variables: Record<string, unknown>): Promise<GitHubIssue[]> {
    return readAllPages(request, repo, { owner, name, pageSize, ...variables });
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
    const item = mapIssue(issue, repo);
    // An issue whose state changes between the two reads appears in both; the first record stands.
    const key = formatItemKey(item);
    if (!items.has(key)) items.set(key, item);
  }
  return items.values().toArray();
}

/** Reads the issues of every repository; any failure rejects the whole read. */
export async function fetchIssuesOfRepos(
  request: GraphqlRequest,
  repos: readonly string[],
  options: FetchIssuesOptions = {},
): Promise<WorkItem[]> {
  const perRepo = await Promise.all(repos.map((repo) => fetchIssues(request, repo, options)));
  return perRepo.flat();
}

// region | Helpers
/** Reads every page of `ISSUES_QUERY` for the variables, following the end cursor. */
async function readAllPages(
  request: GraphqlRequest,
  repo: string,
  variables: Record<string, unknown>,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let after: string | null = null;
  do {
    const parsed = issuesResponseSchema.safeParse(await request(ISSUES_QUERY, { ...variables, after }));
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
