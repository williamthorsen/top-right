import { describe, expect, it } from 'vitest';

import { GitHubAdapterError } from '../fetch-open-issues.ts';
import { fetchViewerLogin } from '../fetch-viewer-login.ts';

describe(fetchViewerLogin, () => {
  it("returns the viewer's login", async () => {
    await expect(fetchViewerLogin(() => Promise.resolve({ data: { viewer: { login: 'octocat' } } }))).resolves.toBe(
      'octocat',
    );
  });

  it.each([
    { case: 'the response has errors', response: { data: null, errors: [{ message: 'Bad credentials' }] } },
    { case: 'the response has no data', response: { data: null } },
    { case: 'the response is malformed', response: { data: { viewer: {} } } },
  ])('raises GitHubAdapterError when $case', async ({ response }) => {
    await expect(fetchViewerLogin(() => Promise.resolve(response))).rejects.toThrow(GitHubAdapterError);
  });
});
