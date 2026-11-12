/** Returns the repository's name without its owner. */
export function nameRepo(repo: string): string {
  return repo.slice(repo.indexOf('/') + 1);
}

/** Returns `repos` sorted by name without the owner, then by `owner/name` among repositories that share a name. */
export function sortRepos(repos: readonly string[]): string[] {
  return repos.toSorted((a, b) => nameRepo(a).localeCompare(nameRepo(b)) || a.localeCompare(b));
}
