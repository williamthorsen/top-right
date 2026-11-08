import { describe, expect, it } from 'vitest';

import { resolveDatabasePath } from '../database-path.ts';

const HOME = '/Users/author';

describe(resolveDatabasePath, () => {
  it('when TOP_RIGHT_DB is set, returns it', () => {
    expect(resolveDatabasePath({ TOP_RIGHT_DB: '/tmp/scores.sqlite', XDG_DATA_HOME: '/data' }, HOME)).toBe(
      '/tmp/scores.sqlite',
    );
  });

  it('when only XDG_DATA_HOME is set, returns the file under it', () => {
    expect(resolveDatabasePath({ XDG_DATA_HOME: '/data' }, HOME)).toBe('/data/top-right/top-right.sqlite');
  });

  it('when neither is set, returns the file under ~/.local/share', () => {
    expect(resolveDatabasePath({ TOP_RIGHT_DB: ' ' }, HOME)).toBe(
      '/Users/author/.local/share/top-right/top-right.sqlite',
    );
  });
});
