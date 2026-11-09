import { describe, expect, it, vi } from 'vitest';

import { fetchIssues, fetchIssuesOfRepos, GitHubAdapterError, type GraphqlRequest } from '../fetch-issues.ts';
import pageOne from './fixtures/open-issues.page-1.json' with { type: 'json' };
import pageTwo from './fixtures/open-issues.page-2.json' with { type: 'json' };

const REPO = 'williamthorsen/top-right';

describe(fetchIssues, () => {
  it('follows the end cursor until the last page', async () => {
    const request = vi.fn<GraphqlRequest>((_query, variables) =>
      Promise.resolve(variables['after'] ? pageTwo : pageOne),
    );

    const items = await fetchIssues(request, REPO, { pageSize: 4 });

    expect(items.map((item) => item.number)).toStrictEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      owner: 'williamthorsen',
      name: 'top-right',
      pageSize: 4,
      after: pageOne.data.repository.issues.pageInfo.endCursor,
    });
  });

  it.each([
    {
      case: 'the response has errors',
      response: { data: null, errors: [{ message: 'Bad credentials' }] },
      message: 'Bad credentials',
    },
    { case: 'the repository is null', response: { data: { repository: null } }, message: 'repository not found' },
    {
      case: 'the response is malformed',
      response: { data: { repository: { issues: {} } } },
      message: 'unexpected response',
    },
  ])('if $case, rejects with an error that names the repository', async ({ response, message }) => {
    const request: GraphqlRequest = () => Promise.resolve(response);

    const result = fetchIssues(request, REPO);

    await expect(result).rejects.toThrow(GitHubAdapterError);
    await expect(result).rejects.toThrow(new RegExp(`^${REPO}: .*${message}`));
  });

  it('without a cutoff, reads only the open issues', async () => {
    const request = vi.fn<GraphqlRequest>((_query, variables) =>
      Promise.resolve(variables['after'] ? pageTwo : pageOne),
    );

    await fetchIssues(request, REPO);

    expect(request.mock.calls.map(([, variables]) => variables['states'])).toStrictEqual([['OPEN'], ['OPEN']]);
    expect(request.mock.calls[0]?.[1]).not.toHaveProperty('filterBy');
  });

  it('with a cutoff, adds only the issues closed at or after it', async () => {
    const cutoff = new Date('2026-11-01T00:00:00Z');
    const closedPage = buildPage([
      buildClosedIssue(101, '2026-11-01T00:00:00Z'),
      buildClosedIssue(102, '2026-11-05T00:00:00Z'),
      // Updated after the cutoff, which `since` lets through, but closed before it.
      buildClosedIssue(103, '2026-10-20T00:00:00Z'),
    ]);
    const request = vi.fn<GraphqlRequest>((_query, variables) => {
      if (Array.isArray(variables['states']) && variables['states'].includes('CLOSED'))
        return Promise.resolve(closedPage);
      return Promise.resolve(variables['after'] ? pageTwo : pageOne);
    });

    const items = await fetchIssues(request, REPO, { closedSince: cutoff });

    expect(items.filter((item) => item.state === 'closed').map((item) => item.number)).toStrictEqual([101, 102]);
    expect(items.filter((item) => item.state === 'open')).toHaveLength(7);
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ states: ['CLOSED'], filterBy: { since: '2026-11-01T00:00:00.000Z' } }),
    );
  });

  it('keeps the first record of an issue that both reads return', async () => {
    const reopened = { ...buildClosedIssue(14, '2026-11-05T00:00:00Z') };
    const request: GraphqlRequest = (_query, variables) =>
      Promise.resolve(
        Array.isArray(variables['states']) && variables['states'].includes('CLOSED')
          ? buildPage([reopened])
          : variables['after']
            ? pageTwo
            : pageOne,
      );

    const items = await fetchIssues(request, REPO, { closedSince: new Date('2026-11-01T00:00:00Z') });

    expect(items.filter((item) => item.number === 14).map((item) => item.state)).toStrictEqual(['open']);
  });

  it('if the repository is not owner/name, rejects without sending a request', async () => {
    const request = vi.fn<GraphqlRequest>();

    await expect(fetchIssues(request, 'top-right')).rejects.toThrow(GitHubAdapterError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe(fetchIssuesOfRepos, () => {
  it('if one repository fails, rejects the whole read', async () => {
    const request: GraphqlRequest = (_query, variables) =>
      Promise.resolve(
        variables['name'] === 'missing' ? { data: { repository: null } } : variables['after'] ? pageTwo : pageOne,
      );

    await expect(fetchIssuesOfRepos(request, [REPO, 'williamthorsen/missing'])).rejects.toThrow(
      'williamthorsen/missing',
    );
  });
});

// region | Helpers
function buildClosedIssue(number: number, closedAt: string) {
  const [template] = pageTwo.data.repository.issues.nodes;
  if (!template) throw new Error('fixture page 2 lacks an issue');
  return { ...template, number, state: 'CLOSED', closedAt, url: `https://github.com/${REPO}/issues/${number}` };
}

function buildPage(nodes: unknown[]) {
  return { data: { repository: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } };
}
// endregion | Helpers
