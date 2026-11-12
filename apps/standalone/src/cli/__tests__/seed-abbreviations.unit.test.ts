import { describe, expect, it } from 'vitest';

import { planAbbreviationSeed, renderSeedText } from '../seed-abbreviations.ts';

const REPOS = ['o/alpha', 'o/beta', 'o/bravo', 'o/gamma'];

describe(planAbbreviationSeed, () => {
  it('sets each named repository that has no stored abbreviation and leaves each that has one', () => {
    const plan = planAbbreviationSeed(['o/alpha=AL', 'o/gamma=GA', 'o/beta=BX'], REPOS, { 'o/beta': 'BE' });

    expect(plan).toStrictEqual({
      kind: 'valid',
      set: [
        { repo: 'o/alpha', abbreviation: 'AL' },
        { repo: 'o/gamma', abbreviation: 'GA' },
      ],
      left: [{ repo: 'o/beta', stored: 'BE' }],
      next: { 'o/beta': 'BE', 'o/alpha': 'AL', 'o/gamma': 'GA' },
    });
  });

  it('keeps the stored abbreviation of a repository that is not configured', () => {
    const plan = planAbbreviationSeed(['o/alpha=AL'], REPOS, { 'o/gone': 'X' });

    expect(plan).toMatchObject({ kind: 'valid', next: { 'o/gone': 'X', 'o/alpha': 'AL' } });
  });

  it('trims both sides of a pair and splits it at the first =', () => {
    const plan = planAbbreviationSeed([' o/alpha = A=1 '], REPOS, {});

    expect(plan).toMatchObject({ kind: 'valid', set: [{ repo: 'o/alpha', abbreviation: 'A=1' }] });
  });

  it('refuses the whole seed, naming each offending argument once', () => {
    const plan = planAbbreviationSeed(
      ['o/alpha=AL', 'o/alpha', 'o/beta=', '=X', 'o/gamma=GA', 'o/gamma=GA', 'o/zeta=Z', 'o/bravo=B.R'],
      REPOS,
      {},
    );

    expect(plan).toStrictEqual({
      kind: 'invalid',
      problems: [
        'argument 2: "o/alpha" is not owner/name=ABBR',
        'argument 3: "o/beta=" is not owner/name=ABBR',
        'argument 4: "=X" is not owner/name=ABBR',
        'argument 6: o/gamma appears more than once',
        'argument 7: o/zeta is not a configured repository',
        'argument 8: "B.R" is not a valid abbreviation for o/bravo. Leave out spaces and dots.',
      ],
    });
  });

  it('refuses a seed that leaves a repository it sets sharing an abbreviation, defaults and stored values included', () => {
    const plan = planAbbreviationSeed(['o/alpha=b', 'o/gamma=Be'], REPOS, { 'o/beta': 'BE' });

    expect(plan).toStrictEqual({
      kind: 'invalid',
      problems: [
        '"b" is used by o/alpha and o/bravo. Give each its own abbreviation.',
        '"be" is used by o/beta and o/gamma. Give each its own abbreviation.',
      ],
    });
  });

  it('refuses a seed whose pair clashes with a stored value of a repository that it leaves', () => {
    const plan = planAbbreviationSeed(['o/beta=X', 'o/alpha=be'], REPOS, { 'o/beta': 'BE' });

    expect(plan).toStrictEqual({
      kind: 'invalid',
      problems: ['"be" is used by o/alpha and o/beta. Give each its own abbreviation.'],
    });
  });

  it('accepts a seed when the only clash is among repositories that it does not set', () => {
    const plan = planAbbreviationSeed(['o/gamma=GA'], REPOS, {});

    expect(plan).toMatchObject({ kind: 'valid', set: [{ repo: 'o/gamma', abbreviation: 'GA' }] });
  });
});

describe(renderSeedText, () => {
  const plan = {
    kind: 'valid' as const,
    set: [
      { repo: 'o/alpha', abbreviation: 'AL' },
      { repo: 'o/gamma', abbreviation: 'GA' },
    ],
    left: [{ repo: 'o/beta', stored: 'BE' }],
    next: {},
  };

  it('reports each repository, then what was set', () => {
    expect(renderSeedText(plan, false)).toBe(
      'o/alpha → AL\no/gamma → GA\no/beta left at BE (stored)\ntop-right: set 2 abbreviations; left 1 stored\n',
    );
  });

  it('reports what a dry run would set and how to set it', () => {
    expect(renderSeedText(plan, true)).toMatch(
      /\ntop-right: 2 abbreviations would be set; left 1 stored; run without --dry-run to set them\n$/,
    );
  });

  it.each([
    { isDryRun: false, summary: 'top-right: set 1 abbreviation\n' },
    { isDryRun: true, summary: 'top-right: 1 abbreviation would be set; run without --dry-run to set them\n' },
  ])('uses the singular without a left clause (dry run: $isDryRun)', ({ isDryRun, summary }) => {
    expect(renderSeedText({ ...plan, set: [{ repo: 'o/alpha', abbreviation: 'AL' }], left: [] }, isDryRun)).toBe(
      `o/alpha → AL\n${summary}`,
    );
  });

  it.each([
    { isDryRun: false, summary: 'top-right: no abbreviation set; left 1 stored\n' },
    { isDryRun: true, summary: 'top-right: no abbreviation would be set; left 1 stored\n' },
  ])('says so when nothing is set (dry run: $isDryRun)', ({ isDryRun, summary }) => {
    expect(renderSeedText({ ...plan, set: [] }, isDryRun)).toBe(`o/beta left at BE (stored)\n${summary}`);
  });
});
