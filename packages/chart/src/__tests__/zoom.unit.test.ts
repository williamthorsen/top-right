import { describe, expect, it } from 'vitest';

import { HEIGHT, WIDTH } from '../Grid.tsx';
import { fitScale, formatScale, isAtEnd, stepZoom } from '../zoom.ts';

describe(stepZoom, () => {
  it('moves to the adjacent step in either direction', () => {
    expect(stepZoom(1, 'in')).toBe(1.25);
    expect(stepZoom(1, 'out')).toBe(0.75);
    expect(stepZoom(2, 'in')).toBe(3);
  });

  it('moves from a scale between steps to the nearest step beyond it', () => {
    expect(stepZoom(1.12, 'in')).toBe(1.25);
    expect(stepZoom(1.12, 'out')).toBe(1);
  });

  it('stays at an end of the range', () => {
    expect(stepZoom(0.5, 'out')).toBe(0.5);
    expect(stepZoom(4, 'in')).toBe(4);
  });
});

describe(isAtEnd, () => {
  it('reports the end in the direction of the step', () => {
    expect(isAtEnd(0.5, 'out')).toBe(true);
    expect(isAtEnd(0.5, 'in')).toBe(false);
    expect(isAtEnd(4, 'in')).toBe(true);
    expect(isAtEnd(4, 'out')).toBe(false);
  });
});

describe(fitScale, () => {
  it('scales the matrix to the smaller of the two ratios, rounded down to a whole percent', () => {
    expect(fitScale(WIDTH * 1.509, HEIGHT * 2)).toBe(1.5);
    expect(fitScale(WIDTH * 3, HEIGHT * 1.256)).toBe(1.25);
  });

  it('never scales below the natural size', () => {
    expect(fitScale(WIDTH / 2, HEIGHT / 2)).toBe(1);
  });

  it('never scales above the largest step', () => {
    expect(fitScale(WIDTH * 10, HEIGHT * 10)).toBe(4);
  });

  it('returns the natural size for an area without size', () => {
    expect(fitScale(0, 0)).toBe(1);
  });
});

describe(formatScale, () => {
  it('formats the scale as a rounded percentage', () => {
    expect(formatScale(1.25)).toBe('125\u{A0}%');
    expect(formatScale(1.126)).toBe('113\u{A0}%');
  });
});
