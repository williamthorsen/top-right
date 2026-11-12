import { describe, expect, it } from 'vitest';

import { abbreviate, formatIdLabel } from '../id-label.ts';

describe(abbreviate, () => {
  it.each([
    { repo: 'williamthorsen/top-right', expected: 'T' },
    { repo: 'williamthorsen/Codeassembly', expected: 'C' },
    { repo: 'name-only', expected: 'N' },
  ])('when the repository is $repo, returns "$expected"', ({ repo, expected }) => {
    expect(abbreviate(repo)).toBe(expected);
  });
});

describe(formatIdLabel, () => {
  it('joins the abbreviation and the number with a dot', () => {
    expect(formatIdLabel({ number: 382 }, 'N')).toBe('N.382');
  });
});
