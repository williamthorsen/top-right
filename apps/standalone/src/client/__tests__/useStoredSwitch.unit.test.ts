// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SHOW_TITLES_KEY, useStoredSwitch } from '../useStoredSwitch.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe(useStoredSwitch, () => {
  it.each([true, false])('restores a stored %s over the fallback', (stored) => {
    localStorage.setItem(SHOW_TITLES_KEY, String(stored));

    const { result } = renderHook(() => useStoredSwitch(SHOW_TITLES_KEY, !stored));

    expect(result.current[0]).toBe(stored);
  });

  it('writes each change', () => {
    const { result } = renderHook(() => useStoredSwitch(SHOW_TITLES_KEY, false));

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(SHOW_TITLES_KEY)).toBe('true');
  });

  it.each([
    { case: 'nothing is stored', stored: undefined },
    { case: 'the stored value is not a boolean', stored: 'yes' },
  ])('opens at the fallback when $case', ({ stored }) => {
    if (stored !== undefined) localStorage.setItem(SHOW_TITLES_KEY, stored);

    const { result } = renderHook(() => useStoredSwitch(SHOW_TITLES_KEY, true));

    expect(result.current[0]).toBe(true);
  });

  it('opens at the fallback and keeps changes when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    const { result } = renderHook(() => useStoredSwitch(SHOW_TITLES_KEY, false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
  });
});
