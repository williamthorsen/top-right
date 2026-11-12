import { describe, expect, it } from 'vitest';

import { resolveFirstLoadRepos } from '../first-load-repos.ts';

const TR = 'williamthorsen/top-right';
const CA = 'williamthorsen/codeassembly';
const TOOLS = 'williamthorsen/toolbelt';
const CONFIGURED = [TR, CA, TOOLS];
const SETTINGS = {
  collections: [{ id: 'c1', name: 'Product', repos: [TR, 'williamthorsen/retired'] }],
  defaultCollectionId: 'c1',
};

describe(resolveFirstLoadRepos, () => {
  it("returns the default collection's configured repositories", () => {
    expect(resolveFirstLoadRepos(SETTINGS, CONFIGURED)).toStrictEqual([TR]);
  });

  it('returns every configured repository without a default collection', () => {
    expect(resolveFirstLoadRepos({ ...SETTINGS, defaultCollectionId: undefined }, CONFIGURED)).toStrictEqual(
      CONFIGURED,
    );
  });

  it("adds the selected item's repository", () => {
    expect(resolveFirstLoadRepos(SETTINGS, CONFIGURED, `${TOOLS}#3`)).toStrictEqual([TR, TOOLS]);
  });

  it('ignores a malformed key and a key in a repository that the config does not list', () => {
    expect(resolveFirstLoadRepos(SETTINGS, CONFIGURED, 'not a key')).toStrictEqual([TR]);
    expect(resolveFirstLoadRepos(SETTINGS, CONFIGURED, 'williamthorsen/retired#3')).toStrictEqual([TR]);
  });
});
