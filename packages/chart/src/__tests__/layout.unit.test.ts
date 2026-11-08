import { describe, expect, it } from 'vitest';

import { CELL_PADDING, CELL_SIZE, GRID_SIZE, GUTTER_ROW_PITCH, layoutCells } from '../layout.ts';

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

  it('keeps the circles of a scored cell inside the cell', () => {
    const placements = Array.from({ length: 9 }, (_, index) => ({ id: String(index), u: 3, i: 4 }));

    const [cell] = layoutCells(placements);

    expect(cell?.isGutter).toBe(false);
    const circles = cell?.circles ?? [];
    for (const circle of circles) {
      expect(circle.cx - circle.r).toBeGreaterThanOrEqual(0);
      expect(circle.cx + circle.r).toBeLessThanOrEqual(CELL_SIZE);
    }
  });

  it('if a placement is outside the grid, throws a RangeError', () => {
    expect(() => layoutCells([{ id: 'a', u: GRID_SIZE, i: 0 }])).toThrow(RangeError);
  });
});
