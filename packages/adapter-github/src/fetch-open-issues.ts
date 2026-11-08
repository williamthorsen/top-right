import type { WorkItem } from '@top-right/model';

import { mapIssue, openIssuesResponseSchema } from './map-issue.ts';
import { OPEN_ISSUES_QUERY } from './query.ts';

/** Sends a GraphQL query to GitHub and resolves to the response body; the host supplies it with its credentials. */
export type GraphqlRequest = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

/** A failure to read a repository's issues, naming the repository. */
export class GitHubAdapterError extends Error {
  override name = 'GitHubAdapterError';
}

const DEFAULT_PAGE_SIZE = 100;

/** Reads every open issue of `repo` (`owner/name`) as work items, page by page. */
export async function fetchOpenIssues(
  request: GraphqlRequest,
  repo: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<WorkItem[]> {
  const [owner, name, extra] = repo.split('/', 3);
  if (!owner || !name || extra !== undefined)
    throw new GitHubAdapterError(`${repo}: expected a repository as owner/name`);

  const items: WorkItem[] = [];
  let after: string | null = null;
  do {
    const parsed = openIssuesResponseSchema.safeParse(
      await request(OPEN_ISSUES_QUERY, { owner, name, pageSize, after }),
    );
    if (!parsed.success)
      throw new GitHubAdapterError(`${repo}: unexpected response from GitHub`, { cause: parsed.error });
    const { data, errors } = parsed.data;
    if (errors?.length) throw new GitHubAdapterError(`${repo}: ${errors.map((error) => error.message).join('; ')}`);
    const issues = data?.repository?.issues;
    if (!issues) throw new GitHubAdapterError(`${repo}: repository not found, or the token cannot read it`);

    items.push(...issues.nodes.map((issue) => mapIssue(issue, repo)));
    after = issues.pageInfo.hasNextPage ? issues.pageInfo.endCursor : null;
  } while (after);
  return items;
}

/** Reads the open issues of every repository; any failure rejects the whole read. */
export async function fetchOpenIssuesOfRepos(request: GraphqlRequest, repos: readonly string[]): Promise<WorkItem[]> {
  const perRepo = await Promise.all(repos.map((repo) => fetchOpenIssues(request, repo)));
  return perRepo.flat();
}
