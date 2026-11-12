import {
  describeAbbreviationClash,
  describeInvalidAbbreviation,
  findAbbreviationClashes,
  isValidAbbreviation,
  resolveAbbreviations,
} from '@top-right/model';

/** A seed that can be written, or the problems that refuse it. */
export type SeedPlan =
  | { kind: 'invalid'; problems: string[] }
  | {
      kind: 'valid';
      /** The repositories that the seed gives an abbreviation, in argument order. */
      set: { repo: string; abbreviation: string }[];
      /** The named repositories that keep their stored abbreviation, in argument order. */
      left: { repo: string; stored: string }[];
      /** The user's abbreviations after the seed, to be written whole. */
      next: Record<string, string>;
    };

/**
 * Plans a seed from `owner/name=ABBR` arguments: Each named repository without a stored abbreviation gets the given
 * one, and a stored one is kept. The whole seed is refused when an argument is malformed, repeats a repository, names a
 * repository outside `configuredRepos`, or holds an invalid abbreviation, or when a repository that it sets would share
 * an abbreviation with another configured repository.
 */
export function planAbbreviationSeed(
  args: readonly string[],
  configuredRepos: readonly string[],
  stored: Readonly<Record<string, string>>,
): SeedPlan {
  const configured = new Set(configuredRepos);
  const problems: string[] = [];
  const set: { repo: string; abbreviation: string }[] = [];
  const left: { repo: string; stored: string }[] = [];
  const seen = new Set<string>();
  for (const [index, arg] of args.entries()) {
    const label = `argument ${index + 1}`;
    const pair = parsePair(arg);
    if (!pair) {
      problems.push(`${label}: "${arg}" is not owner/name=ABBR`);
      continue;
    }
    const { repo, abbreviation } = pair;
    if (seen.has(repo)) problems.push(`${label}: ${repo} appears more than once`);
    else if (!configured.has(repo)) problems.push(`${label}: ${repo} is not a configured repository`);
    else if (!isValidAbbreviation(abbreviation))
      problems.push(`${label}: ${describeInvalidAbbreviation(repo, abbreviation)}`);
    else {
      const storedAbbreviation = stored[repo];
      if (storedAbbreviation === undefined) set.push({ repo, abbreviation });
      else left.push({ repo, stored: storedAbbreviation });
    }
    seen.add(repo);
  }
  if (problems.length > 0) return { kind: 'invalid', problems };

  const next = { ...stored, ...Object.fromEntries(set.map(({ repo, abbreviation }) => [repo, abbreviation])) };
  const setRepos = new Set(set.map(({ repo }) => repo));
  const clashes = findAbbreviationClashes(resolveAbbreviations(configuredRepos, next)).filter((clash) =>
    clash.repos.some((repo) => setRepos.has(repo)),
  );
  if (clashes.length > 0)
    return { kind: 'invalid', problems: clashes.map((clash) => describeAbbreviationClash(clash)) };
  return { kind: 'valid', set, left, next };
}

/** Returns the report of a valid seed: one line per repository that it sets or leaves, then a summary. */
export function renderSeedText(plan: Extract<SeedPlan, { kind: 'valid' }>, isDryRun: boolean): string {
  const lines = [
    ...plan.set.map(({ repo, abbreviation }) => `${repo} → ${abbreviation}\n`),
    ...plan.left.map(({ repo, stored }) => `${repo} left at ${stored} (stored)\n`),
  ];
  const count = plan.set.length;
  const counted = `${count} ${count === 1 ? 'abbreviation' : 'abbreviations'}`;
  const leftClause = plan.left.length > 0 ? `; left ${plan.left.length} stored` : '';
  if (count === 0) lines.push(`top-right: no abbreviation ${isDryRun ? 'would be set' : 'set'}${leftClause}\n`);
  else if (isDryRun) lines.push(`top-right: ${counted} would be set${leftClause}; run without --dry-run to set them\n`);
  else lines.push(`top-right: set ${counted}${leftClause}\n`);
  return lines.join('');
}

// region | Helpers
/** Splits `owner/name=ABBR` at its first `=` and trims both sides; undefined when either side is empty. */
function parsePair(arg: string): { repo: string; abbreviation: string } | undefined {
  const separator = arg.indexOf('=');
  if (separator === -1) return undefined;
  const repo = arg.slice(0, separator).trim();
  const abbreviation = arg.slice(separator + 1).trim();
  return repo === '' || abbreviation === '' ? undefined : { repo, abbreviation };
}
// endregion | Helpers
