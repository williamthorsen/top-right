// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAGNIFICATION_KEY, useStoredMagnification } from '../useStoredMagnification.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe(useStoredMagnification, () => {
  it('restores a stored step', () => {
    localStorage.setItem(MAGNIFICATION_KEY, '1.50');

    const { result } = renderHook(() => useStoredMagnification());

    expect(result.current[0]).toBe(1.5);
  });

  it('writes each change', () => {
    const { result } = renderHook(() => useStoredMagnification());

    act(() => result.current[1](2));

    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem(MAGNIFICATION_KEY)).toBe('2');
  });

  it.each([
    { case: 'nothing is stored', stored: undefined },
    { case: 'the stored value is not a number', stored: 'abc' },
    { case: 'the stored value is not a step', stored: '1.1' },
  ])('opens at the natural size when $case', ({ stored }) => {
    if (stored !== undefined) localStorage.setItem(MAGNIFICATION_KEY, stored);

    const { result } = renderHook(() => useStoredMagnification());

    expect(result.current[0]).toBe(1);
  });

  it('opens at the natural size and keeps changes when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    const { result } = renderHook(() => useStoredMagnification());
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](3));

    expect(result.current[0]).toBe(3);
  });
});
