import { describe, expect, it } from 'vitest';

import { findNearestScrollDelta } from '../chart-scroll.ts';

describe(findNearestScrollDelta, () => {
  it('returns zero for a span already within the view, at its edges included', () => {
    expect(findNearestScrollDelta(10, 30, 0, 100)).toBe(0);
    expect(findNearestScrollDelta(0, 100, 0, 100)).toBe(0);
  });

  it('brings a span below the view up to its bottom edge', () => {
    expect(findNearestScrollDelta(150, 174, 0, 100)).toBe(74);
  });

  it('brings a span above the view down to its top edge', () => {
    expect(findNearestScrollDelta(-50, -26, 0, 100)).toBe(-50);
  });

  it('aligns the start of a span longer than the view with the view', () => {
    expect(findNearestScrollDelta(150, 300, 0, 100)).toBe(150);
    expect(findNearestScrollDelta(-50, 120, 0, 100)).toBe(-50);
  });
});
