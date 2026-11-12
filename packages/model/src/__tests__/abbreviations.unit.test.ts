import { describe, expect, it } from 'vitest';

import {
  describeAbbreviationClash,
  findAbbreviationClashes,
  isValidAbbreviation,
  resolveAbbreviations,
} from '../abbreviations.ts';

describe(resolveAbbreviations, () => {
  it('takes the stored abbreviation, else the uppercase first letter', () => {
    const resolved = resolveAbbreviations(['w/top-right', 'w/codeassembly'], { 'w/codeassembly': 'ca' });

    expect(resolved).toStrictEqual({ 'w/top-right': 'T', 'w/codeassembly': 'ca' });
  });

  it('keeps the case of a stored abbreviation that matches the default letter', () => {
    expect(resolveAbbreviations(['w/top-right'], { 'w/top-right': 't' })).toStrictEqual({ 'w/top-right': 't' });
  });

  it('ignores a stored abbreviation of a repository outside the list', () => {
    expect(resolveAbbreviations(['w/top-right'], { 'w/gone': 'g' })).toStrictEqual({ 'w/top-right': 'T' });
  });
});

describe(findAbbreviationClashes, () => {
  it('reports the repositories that share an abbreviation, compared case-insensitively', () => {
    const clashes = findAbbreviationClashes({ 'w/a': 'C', 'w/configs': 'c', 'w/top-right': 't' });

    expect(clashes).toStrictEqual([{ abbreviation: 'c', repos: ['w/a', 'w/configs'] }]);
  });

  it('reports nothing when every abbreviation is distinct', () => {
    expect(findAbbreviationClashes({ 'w/a': 'a', 'w/b': 'b' })).toStrictEqual([]);
  });
});

describe(isValidAbbreviation, () => {
  it.each([
    { abbreviation: 'ca', expected: true },
    { abbreviation: 'c-g', expected: true },
    { abbreviation: '', expected: false },
    { abbreviation: 'c a', expected: false },
    { abbreviation: 'c.a', expected: false },
  ])('when the abbreviation is "$abbreviation", returns $expected', ({ abbreviation, expected }) => {
    expect(isValidAbbreviation(abbreviation)).toBe(expected);
  });
});

describe(describeAbbreviationClash, () => {
  it('names the abbreviation, every repository, and the fix', () => {
    expect(describeAbbreviationClash({ abbreviation: 'c', repos: ['w/a', 'w/b', 'w/c'] })).toBe(
      '"c" is used by w/a, w/b and w/c. Give each its own abbreviation.',
    );
  });
});
