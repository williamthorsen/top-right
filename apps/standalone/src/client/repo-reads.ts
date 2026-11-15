import type { ItemsResponse } from '#src/shared/items-response.ts';

/** Returns the repositories whose read the host judged stale. */
export function listStaleRepos(reads: ItemsResponse['reads']): string[] {
  return Object.entries(reads)
    .filter(([, read]) => read.isStale)
    .map(([repo]) => repo);
}

/**
 * Returns the oldest read time among `repos`, or among every read when none of `repos` has been read, as an ISO
 * timestamp; undefined without any read.
 */
export function findOldestRead(reads: ItemsResponse['reads'], repos: readonly string[]): string | undefined {
  const shown = repos.flatMap((repo) => reads[repo]?.readAt ?? []);
  const candidates = shown.length > 0 ? shown : Object.values(reads).map((read) => read.readAt);
  return candidates.toSorted()[0];
}
