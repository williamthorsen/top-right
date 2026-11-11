import { describe, expect, it, vi } from 'vitest';

import { describeScopeWarnings, fetchTokenScopes } from '../token-scopes.ts';

const BOTH = { hasLabelRepos: true, hasProjectRepos: true };

describe(fetchTokenScopes, () => {
  it('returns the scopes that GitHub reports, sending the token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('{}', { headers: { 'x-oauth-scopes': 'repo, read:org,project' } })),
    );

    await expect(fetchTokenScopes('secret', fetchImpl)).resolves.toStrictEqual(['repo', 'read:org', 'project']);
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer secret');
  });

  it.each([
    { case: 'GitHub reports no scopes header', fetchImpl: () => Promise.resolve(new Response('{}')) },
    {
      case: 'GitHub refuses the request',
      fetchImpl: () => Promise.resolve(new Response('', { status: 401, headers: { 'x-oauth-scopes': 'repo' } })),
    },
    { case: 'the request fails', fetchImpl: () => Promise.reject(new Error('offline')) },
  ])('returns undefined when $case', async ({ fetchImpl }) => {
    await expect(fetchTokenScopes('secret', fetchImpl)).resolves.toBeUndefined();
  });
});

describe(describeScopeWarnings, () => {
  it('warns about the project scope for project repositories, naming the fix', () => {
    const warnings = describeScopeWarnings(['repo', 'read:project'], BOTH);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/"project" scope.*gh auth refresh --scopes project/);
  });

  it('warns about the repo scopes for label repositories', () => {
    expect(describeScopeWarnings(['project'], BOTH)).toStrictEqual([expect.stringMatching(/"repo" and "public_repo"/)]);
  });

  it.each([
    { case: 'the token has the scopes', scopes: ['public_repo', 'project'], use: BOTH },
    { case: 'no repository uses a project', scopes: ['repo'], use: { ...BOTH, hasProjectRepos: false } },
    { case: 'every repository uses a project', scopes: ['project'], use: { ...BOTH, hasLabelRepos: false } },
    { case: 'GitHub reports no scopes', scopes: undefined, use: BOTH },
  ])('returns none when $case', ({ scopes, use }) => {
    expect(describeScopeWarnings(scopes, use)).toStrictEqual([]);
  });
});
