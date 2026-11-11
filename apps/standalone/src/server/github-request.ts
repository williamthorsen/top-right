import type { GraphqlRequest } from '@top-right/adapter-github';

const GRAPHQL_URL = 'https://api.github.com/graphql';

/** The user agent that the host sends with every request to GitHub. */
export const GITHUB_USER_AGENT = 'top-right-local';

/** Returns a GraphQL request function that sends `token` with each request. */
export function createGithubRequest(token: string, fetchImpl: typeof fetch = fetch): GraphqlRequest {
  return async (query, variables) => {
    const response = await fetchImpl(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': GITHUB_USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(describeStatus(response));
    const body: unknown = await response.json();
    return body;
  };
}

// region | Helpers
function describeStatus(response: Response): string {
  if (response.status === 401)
    return 'GitHub rejected the token (401). Set a valid GITHUB_TOKEN, or run `gh auth login`.';
  if (response.status === 403 || response.status === 429) {
    return `GitHub refused the request (${response.status}), probably a rate limit. Try again later.`;
  }
  return `GitHub responded ${response.status} ${response.statusText}.`;
}
// endregion | Helpers
