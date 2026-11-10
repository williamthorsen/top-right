import { describe, expect, it } from 'vitest';

import { formatItemKey, parseItemKey } from '../work-item.ts';

describe(parseItemKey, () => {
  it('returns the repository and number of a key that formatItemKey writes', () => {
    const ref = { repo: 'owner/name', number: 42 };

    expect(parseItemKey(formatItemKey(ref))).toEqual(ref);
  });

  it.each(['owner/name', 'owner#1', 'owner/name#', 'owner/name#0', 'owner/name#1#2', 'a/b/c#1'])(
    'if the key is %s, returns undefined',
    (itemKey) => {
      expect(parseItemKey(itemKey)).toBeUndefined();
    },
  );
});
