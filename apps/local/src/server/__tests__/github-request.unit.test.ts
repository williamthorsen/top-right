import { describe, expect, it, vi } from 'vitest';

import { createGithubRequest } from '../github-request.ts';

describe(createGithubRequest, () => {
  it('sends the query with the token and resolves to the response body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ data: {} })));

    await expect(createGithubRequest('secret', fetchImpl)('query', { a: 1 })).resolves.toStrictEqual({ data: {} });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret');
    expect(init?.body).toBe(JSON.stringify({ query: 'query', variables: { a: 1 } }));
  });

  it.each([
    { status: 401, message: /rejected the token/ },
    { status: 403, message: /rate limit/ },
    { status: 500, message: /responded 500/ },
  ])('if GitHub responds $status, rejects with a message that names the cause', async ({ status, message }) => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status })));

    await expect(createGithubRequest('secret', fetchImpl)('query', {})).rejects.toThrow(message);
  });
});
