import { abbreviate } from './id-label.ts';

/** Repositories whose abbreviations match case-insensitively. */
export interface AbbreviationClash {
  /** The shared abbreviation, lowercased. */
  abbreviation: string;
  /** The repositories that share it, as `owner/name`. */
  repos: string[];
}

/** Returns the repositories that share an abbreviation, compared case-insensitively, in the order of `abbreviations`. */
export function findAbbreviationClashes(abbreviations: Readonly<Record<string, string>>): AbbreviationClash[] {
  const reposByAbbreviation = new Map<string, string[]>();
  for (const [repo, abbreviation] of Object.entries(abbreviations)) {
    const key = abbreviation.toLowerCase();
    reposByAbbreviation.set(key, [...(reposByAbbreviation.get(key) ?? []), repo]);
  }
  return [...reposByAbbreviation]
    .filter(([, repos]) => repos.length > 1)
    .map(([abbreviation, repos]) => ({ abbreviation, repos }));
}

/** Returns whether `abbreviation` can lead an id: non-empty and free of whitespace and dots, since an id is `{abbreviation}.{number}`. */
export function isValidAbbreviation(abbreviation: string): boolean {
  return /^[^\s.]+$/.test(abbreviation);
}

/**
 * Returns the abbreviation of each of `repos`, keyed by `owner/name`: the stored one, or the repository's first letter.
 * A stored abbreviation of a repository outside `repos` is ignored.
 */
export function resolveAbbreviations(
  repos: readonly string[],
  stored: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(repos.map((repo) => [repo, stored[repo] ?? abbreviate(repo)]));
}
