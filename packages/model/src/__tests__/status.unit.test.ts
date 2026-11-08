import { describe, expect, it } from 'vitest';

import { deriveStatus, isOverrideVoid, type StatusOverride } from '../status.ts';

const AT = '2026-11-08T00:00:00.000Z';
const IN_PROGRESS_WHILE_OPEN: StatusOverride = { status: 'in-progress', sourceState: 'open', at: AT };

describe(deriveStatus, () => {
  it('returns to-do for an open item without an override', () => {
    expect(deriveStatus({ state: 'open' }, undefined)).toBe('to-do');
  });

  it('returns the override for an open item whose state has not changed', () => {
    expect(deriveStatus({ state: 'open' }, IN_PROGRESS_WHILE_OPEN)).toBe('in-progress');
  });

  it('returns done for a closed item, whatever the override says', () => {
    expect(deriveStatus({ state: 'closed' }, IN_PROGRESS_WHILE_OPEN)).toBe('done');
  });

  it('ignores an override set against another source state', () => {
    expect(deriveStatus({ state: 'open' }, { ...IN_PROGRESS_WHILE_OPEN, sourceState: 'closed' })).toBe('to-do');
  });
});

describe(isOverrideVoid, () => {
  it('returns false while the source state matches the one recorded', () => {
    expect(isOverrideVoid({ state: 'open' }, IN_PROGRESS_WHILE_OPEN)).toBe(false);
  });

  it('returns true once the source state has changed', () => {
    expect(isOverrideVoid({ state: 'closed' }, IN_PROGRESS_WHILE_OPEN)).toBe(true);
  });
});
