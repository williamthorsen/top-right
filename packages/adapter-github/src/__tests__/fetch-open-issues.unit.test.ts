import { describe, expect, it, vi } from 'vitest';

import {
  fetchOpenIssues,
  fetchOpenIssuesOfRepos,
  GitHubAdapterError,
  type GraphqlRequest,
} from '../fetch-open-issues.ts';
import pageOne from './fixtures/open-issues.page-1.json' with { type: 'json' };
import pageTwo from './fixtures/open-issues.page-2.json' with { type: 'json' };

const REPO = 'williamthorsen/top-right';

describe(fetchOpenIssues, () => {
  it('follows the end cursor until the last page', async () => {
    const request = vi.fn<GraphqlRequest>((_query, variables) =>
      Promise.resolve(variables['after'] ? pageTwo : pageOne),
    );

    const items = await fetchOpenIssues(request, REPO, 4);

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

    const result = fetchOpenIssues(request, REPO);

    await expect(result).rejects.toThrow(GitHubAdapterError);
    await expect(result).rejects.toThrow(new RegExp(`^${REPO}: .*${message}`));
  });

  it('if the repository is not owner/name, rejects without sending a request', async () => {
    const request = vi.fn<GraphqlRequest>();

    await expect(fetchOpenIssues(request, 'top-right')).rejects.toThrow(GitHubAdapterError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe(fetchOpenIssuesOfRepos, () => {
  it('if one repository fails, rejects the whole read', async () => {
    const request: GraphqlRequest = (_query, variables) =>
      Promise.resolve(
        variables['name'] === 'missing' ? { data: { repository: null } } : variables['after'] ? pageTwo : pageOne,
      );

    await expect(fetchOpenIssuesOfRepos(request, [REPO, 'williamthorsen/missing'])).rejects.toThrow(
      'williamthorsen/missing',
    );
  });
});
