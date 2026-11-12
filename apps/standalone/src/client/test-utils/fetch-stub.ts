import { vi } from 'vitest';

/** Returns the repositories that each POST to `path` named, in the order in which the page sent them. */
export function listPostedRepos(path: string): unknown[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([input]) => input === path)
    .map(([, init]) => {
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      return typeof body === 'object' && body !== null && 'repos' in body ? body.repos : undefined;
    });
}

/** Replaces `fetch` with a mock that answers each request by its path, without the query. */
export function stubFetch(respond: (path: string) => Promise<Response>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      respond(
        new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost')
          .pathname,
      ),
    ),
  );
}
