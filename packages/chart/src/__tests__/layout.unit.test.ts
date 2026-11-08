import { describe, expect, it } from 'vitest';

import {
  CELL_PADDING,
  CELL_SIZE,
  FLOOR_RADIUS,
  GRID_SIZE,
  GUTTER_ROW_PITCH,
  layoutCells,
  RADIUS_PER_POINT,
  sizeCircle,
} from '../layout.ts';

/** The most rows that fit a gutter cell, derived from the geometry. */
const ROWS_THAT_FIT = Math.floor((CELL_SIZE - 2 * CELL_PADDING) / GUTTER_ROW_PITCH);

describe(layoutCells, () => {
  it('places unscored items in the corner cell at the bottom left of the matrix', () => {
    const [corner, ...rest] = layoutCells([
      { id: 'a', u: 0, i: 0 },
      { id: 'b', u: 0, i: 0 },
    ]);

    expect(rest).toHaveLength(0);
    expect(corner).toMatchObject({ isGutter: true, ids: ['a', 'b'], x: 0, y: (GRID_SIZE - 1) * CELL_SIZE });
  });

  it.each([
    { count: ROWS_THAT_FIT, overflow: false },
    { count: ROWS_THAT_FIT + 1, overflow: true },
  ])('when a gutter cell lists $count items, sets overflow to $overflow', ({ count, overflow }) => {
    const placements = Array.from({ length: count }, (_, index) => ({ id: String(index), u: 0, i: 0 }));

    expect(layoutCells(placements)[0]?.overflow).toBe(overflow);
  });

  it.each([
    { case: 'nine floor-sized circles', radii: Array.from({ length: 9 }, () => FLOOR_RADIUS) },
    { case: 'an overfull cell of large circles', radii: Array.from({ length: 12 }, () => sizeCircle(13).r) },
  ])('keeps $case inside their cell', ({ radii }) => {
    const [cell] = layoutCells(radii.map((r, index) => ({ id: String(index), u: 3, i: 4, r, floored: false })));

    expect(cell?.isGutter).toBe(false);
    expect(cell?.circles).toHaveLength(radii.length);
    const circles = cell?.circles ?? [];
    for (const circle of circles) {
      expect(Math.min(circle.cx, circle.cy) - circle.r).toBeGreaterThanOrEqual(0);
      expect(Math.max(circle.cx, circle.cy) + circle.r).toBeLessThanOrEqual(CELL_SIZE);
    }
  });

  it('puts the largest circle at the centre and the others clear of each other, largest first', () => {
    const [cell] = layoutCells([
      { id: 'small', u: 2, i: 2, ...sizeCircle(1) },
      { id: 'large', u: 2, i: 2, ...sizeCircle(13) },
      { id: 'medium', u: 2, i: 2, ...sizeCircle(5) },
    ]);
    const circles = cell?.circles ?? [];

    expect(circles.map((circle) => circle.id)).toStrictEqual(['large', 'medium', 'small']);
    expect(circles[0]).toMatchObject({ cx: CELL_SIZE / 2, cy: CELL_SIZE / 2 });
    for (const [index, circle] of circles.entries()) {
      const later = circles.slice(index + 1);
      for (const other of later) {
        expect(Math.hypot(circle.cx - other.cx, circle.cy - other.cy)).toBeGreaterThanOrEqual(circle.r + other.r);
      }
    }
  });

  it('when a placement has no radius, draws it at the floor and marks it floored', () => {
    const [cell] = layoutCells([{ id: 'a', u: 1, i: 1 }]);

    expect(cell?.circles[0]).toMatchObject({ r: FLOOR_RADIUS, floored: true });
  });

  it('if a placement is outside the grid, throws a RangeError', () => {
    expect(() => layoutCells([{ id: 'a', u: GRID_SIZE, i: 0 }])).toThrow(RangeError);
  });
});

describe(sizeCircle, () => {
  it('gives a circle an area proportional to its points', () => {
    expect(sizeCircle(4)).toStrictEqual({ r: 2 * RADIUS_PER_POINT, floored: false });
    expect(sizeCircle(1).r ** 2 * 9).toBeCloseTo(sizeCircle(9).r ** 2);
  });

  it('draws an unsized item at the floor, marked as floored', () => {
    expect(sizeCircle(undefined)).toStrictEqual({ r: FLOOR_RADIUS, floored: true });
  });

  it('raises a circle smaller than the floor to the floor', () => {
    expect(sizeCircle(0.5)).toStrictEqual({ r: FLOOR_RADIUS, floored: true });
  });
});
