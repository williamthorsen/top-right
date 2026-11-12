import { describe, expect, it } from 'vitest';

import { measureFrame } from '../Grid.tsx';
import { MIN_CELL_SIZE } from '../layout.ts';
import { fitCellSize, formatScale, isAtEnd, stepZoom } from '../zoom.ts';

/** The chart's size in chart units at the smallest cell. */
const FRAME = measureFrame(MIN_CELL_SIZE);

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

describe(fitCellSize, () => {
  it('sizes the cells so that the matrix fills the smaller of the two dimensions, rounded down to a whole unit', () => {
    expect(fitCellSize(FRAME.width + 5 * 50.5, FRAME.height + 5 * 100, 1)).toBe(MIN_CELL_SIZE + 50);
    expect(fitCellSize(FRAME.width * 3, FRAME.height + 5 * 30, 1)).toBe(MIN_CELL_SIZE + 30);
  });

  it('measures the area in chart units at the magnification', () => {
    expect(fitCellSize((FRAME.width + 5 * 40) * 2, (FRAME.height + 5 * 40) * 2, 2)).toBe(MIN_CELL_SIZE + 40);
  });

  it('never sizes a cell below the minimum', () => {
    expect(fitCellSize(FRAME.width / 2, FRAME.height / 2, 1)).toBe(MIN_CELL_SIZE);
    expect(fitCellSize(FRAME.width * 1.5, FRAME.height * 1.5, 2)).toBe(MIN_CELL_SIZE);
  });

  it('returns the minimum for an area without size', () => {
    expect(fitCellSize(0, 0, 1)).toBe(MIN_CELL_SIZE);
  });
});

describe(formatScale, () => {
  it('formats the scale as a rounded percentage', () => {
    expect(formatScale(1.25)).toBe('125\u{A0}%');
    expect(formatScale(1.126)).toBe('113\u{A0}%');
  });
});
