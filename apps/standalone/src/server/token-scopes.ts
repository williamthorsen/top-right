import { GITHUB_USER_AGENT } from './github-request.ts';

const API_ROOT_URL = 'https://api.github.com/';

/** Which status strategies the configured repositories use. */
export interface StrategyUse {
  hasLabelRepos: boolean;
  hasProjectRepos: boolean;
}

/**
 * Returns a warning for each strategy whose writes the token's scopes do not allow; scopes that GitHub did not report,
 * as for a fine-grained token, yield none.
 */
export function describeScopeWarnings(
  scopes: readonly string[] | undefined,
  { hasLabelRepos, hasProjectRepos }: StrategyUse,
): string[] {
  if (scopes === undefined) return [];
  const warnings: string[] = [];
  if (hasProjectRepos && !scopes.includes('project')) {
    warnings.push(
      'The GitHub token lacks the "project" scope, so a status set in the pane cannot be written to a GitHub Project. Run `gh auth refresh --scopes project`, or set GITHUB_TOKEN to a token with the scope.',
    );
  }
  if (hasLabelRepos && !scopes.includes('repo') && !scopes.includes('public_repo')) {
    warnings.push(
      'The GitHub token lacks the "repo" and "public_repo" scopes, so a status or a score set in the pane cannot be written to labels. Run `gh auth refresh --scopes repo`, or set GITHUB_TOKEN to a token with the scope.',
    );
  }
  return warnings;
}

/** Returns the scopes that GitHub reports for `token`, or undefined when it reports none or the read fails. */
export async function fetchTokenScopes(token: string, fetchImpl: typeof fetch = fetch): Promise<string[] | undefined> {
  let response: Response;
  try {
    response = await fetchImpl(API_ROOT_URL, {
      headers: { authorization: `Bearer ${token}`, 'user-agent': GITHUB_USER_AGENT },
    });
  } catch {
    return undefined;
  }
  const header = response.ok ? response.headers.get('x-oauth-scopes') : null;
  if (header === null) return undefined;
  return header
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope !== '');
}
