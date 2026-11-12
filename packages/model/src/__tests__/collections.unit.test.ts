import { describe, expect, it } from 'vitest';

import { type Collection, EMPTY_REPO_SCOPE, findCollectionProblem, resolveShownRepos } from '../collections.ts';

const CONFIGURED = ['o/a', 'o/b', 'o/c'];

describe(findCollectionProblem, () => {
  it('accepts valid collections and a default that names one of them', () => {
    const collections = [buildCollection('c1', 'Core', ['o/a']), buildCollection('c2', 'Tools', ['o/b', 'o/c'])];

    expect(findCollectionProblem({ collections, defaultCollectionId: 'c2' }, CONFIGURED)).toBeUndefined();
  });

  it('accepts an empty list without a default', () => {
    expect(findCollectionProblem({ collections: [], defaultCollectionId: undefined }, CONFIGURED)).toBeUndefined();
  });

  it('refuses an empty name, ignoring whitespace', () => {
    const collections = [buildCollection('c1', '  ', ['o/a'])];

    expect(findCollectionProblem({ collections, defaultCollectionId: undefined }, CONFIGURED)).toBe(
      'Give every collection a name.',
    );
  });

  it('refuses a name that another collection uses, trimmed and compared case-insensitively', () => {
    const collections = [buildCollection('c1', 'Core', ['o/a']), buildCollection('c2', ' core ', ['o/b'])];

    expect(findCollectionProblem({ collections, defaultCollectionId: undefined }, CONFIGURED)).toBe(
      'More than one collection is named "core". Give each its own name.',
    );
  });

  it('refuses a collection without repositories', () => {
    const collections = [buildCollection('c1', 'Core', [])];

    expect(findCollectionProblem({ collections, defaultCollectionId: undefined }, CONFIGURED)).toBe(
      '"Core" does not include any repository. Add one or delete the collection.',
    );
  });

  it('refuses a repository that the config does not list', () => {
    const collections = [buildCollection('c1', 'Core', ['o/a', 'o/z'])];

    expect(findCollectionProblem({ collections, defaultCollectionId: undefined }, CONFIGURED)).toBe(
      '"Core" includes o/z, which the config does not list.',
    );
  });

  it('refuses a default that names an unknown collection', () => {
    const collections = [buildCollection('c1', 'Core', ['o/a'])];

    expect(findCollectionProblem({ collections, defaultCollectionId: 'gone' }, CONFIGURED)).toBe(
      'The default collection does not exist. Choose another default.',
    );
  });
});

describe(resolveShownRepos, () => {
  const collections = [buildCollection('c1', 'Core', ['o/a', 'o/b']), buildCollection('c2', 'Tools', ['o/b'])];

  it('returns undefined for an empty scope, which shows every repo', () => {
    expect(resolveShownRepos(EMPTY_REPO_SCOPE, collections)).toBeUndefined();
  });

  it('returns the union of the selected collections and repositories', () => {
    const scope = { collectionIds: new Set(['c1', 'c2']), repos: new Set(['o/c']) };

    expect(resolveShownRepos(scope, collections)).toEqual(new Set(['o/a', 'o/b', 'o/c']));
  });

  it('ignores an unknown collection id', () => {
    const scope = { collectionIds: new Set(['gone']), repos: new Set<string>() };

    expect(resolveShownRepos(scope, collections)).toEqual(new Set());
  });
});

// region | Helpers
function buildCollection(id: string, name: string, repos: string[]): Collection {
  return { id, name, repos };
}
// endregion | Helpers
