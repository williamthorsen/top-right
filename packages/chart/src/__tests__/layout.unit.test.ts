import type { ItemScores, WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import {
  CELL_PADDING,
  findCellLevels,
  findScoredCellAt,
  FLOOR_RADIUS,
  GRID_SIZE,
  GUTTER_ROW_PITCH,
  layoutCells,
  MIN_CELL_SIZE,
  placeGhosts,
  placeItems,
  RADIUS_PER_POINT,
  sizeCircle,
  sizeItem,
} from '../layout.ts';

/** The most rows that fit a gutter cell, derived from the geometry. */
const ROWS_THAT_FIT = Math.floor((MIN_CELL_SIZE - 2 * CELL_PADDING) / GUTTER_ROW_PITCH);

describe(findCellLevels, () => {
  it('returns the levels of a scored cell', () => {
    expect(findCellLevels(1, 4)).toStrictEqual({ urgency: 'low', value: 'must-have' });
    expect(findCellLevels(4, 1)).toStrictEqual({ urgency: 'critical', value: 'questionable' });
  });

  it.each([
    { u: 0, v: 2 },
    { u: 2, v: 0 },
    { u: 5, v: 2 },
  ])('returns undefined for the cell at $u, $v', ({ u, v }) => {
    expect(findCellLevels(u, v)).toBeUndefined();
  });
});

describe(findScoredCellAt, () => {
  it('returns the scored cell that contains an interior point', () => {
    expect(findScoredCellAt(MIN_CELL_SIZE * 2.5, MIN_CELL_SIZE * 0.5, MIN_CELL_SIZE)).toStrictEqual({ u: 2, v: 4 });
    expect(findScoredCellAt(MIN_CELL_SIZE * 4.5, MIN_CELL_SIZE * 3.5, MIN_CELL_SIZE)).toStrictEqual({ u: 4, v: 1 });
  });

  it('maps a point by the cell size that it is given', () => {
    expect(findScoredCellAt(250, 50, 200)).toStrictEqual({ u: 1, v: 4 });
    expect(findScoredCellAt(250, 50, MIN_CELL_SIZE)).toStrictEqual({ u: 2, v: 4 });
  });

  it('gives a point on a shared edge to the cell to its right or below it', () => {
    expect(findScoredCellAt(MIN_CELL_SIZE * 3, MIN_CELL_SIZE * 2, MIN_CELL_SIZE)).toStrictEqual({ u: 3, v: 2 });
  });

  it.each([
    { case: 'the unscored-urgency column', x: MIN_CELL_SIZE * 0.5, y: MIN_CELL_SIZE * 2.5 },
    { case: 'the unscored-value row', x: MIN_CELL_SIZE * 2.5, y: MIN_CELL_SIZE * 4.5 },
    { case: 'left of the matrix', x: -1, y: MIN_CELL_SIZE * 2.5 },
    { case: 'above the matrix', x: MIN_CELL_SIZE * 2.5, y: -1 },
    { case: 'on the far right edge', x: MIN_CELL_SIZE * GRID_SIZE, y: MIN_CELL_SIZE * 2.5 },
    { case: 'on the far bottom edge', x: MIN_CELL_SIZE * 2.5, y: MIN_CELL_SIZE * GRID_SIZE },
  ])('returns undefined for a point in $case', ({ x, y }) => {
    expect(findScoredCellAt(x, y, MIN_CELL_SIZE)).toBeUndefined();
  });
});

describe(layoutCells, () => {
  it('places unscored items in the corner cell at the bottom left of the matrix', () => {
    const [corner, ...rest] = layoutCells(
      [
        { id: 'a', u: 0, v: 0 },
        { id: 'b', u: 0, v: 0 },
      ],
      MIN_CELL_SIZE,
    );

    expect(rest).toHaveLength(0);
    expect(corner).toMatchObject({ isGutter: true, ids: ['a', 'b'], x: 0, y: (GRID_SIZE - 1) * MIN_CELL_SIZE });
  });

  it.each([
    { count: ROWS_THAT_FIT, overflow: false },
    { count: ROWS_THAT_FIT + 1, overflow: true },
  ])('when a gutter cell lists $count items, sets overflow to $overflow', ({ count, overflow }) => {
    const placements = Array.from({ length: count }, (_, index) => ({ id: String(index), u: 0, v: 0 }));

    expect(layoutCells(placements, MIN_CELL_SIZE)[0]?.overflow).toBe(overflow);
  });

  it.each([
    { case: 'nine floor-sized circles', radii: Array.from({ length: 9 }, () => FLOOR_RADIUS) },
    { case: 'an overfull cell of large circles', radii: Array.from({ length: 12 }, () => sizeCircle(13).r) },
  ])('keeps $case inside their cell', ({ radii }) => {
    const [cell] = layoutCells(
      radii.map((r, index) => ({ id: String(index), u: 3, v: 4, r, isUnsized: false })),
      MIN_CELL_SIZE,
    );

    expect(cell?.isGutter).toBe(false);
    expect(cell?.circles).toHaveLength(radii.length);
    const circles = cell?.circles ?? [];
    for (const circle of circles) {
      expect(Math.min(circle.cx, circle.cy) - circle.r).toBeGreaterThanOrEqual(0);
      expect(Math.max(circle.cx, circle.cy) + circle.r).toBeLessThanOrEqual(MIN_CELL_SIZE);
    }
  });

  it('puts the largest circle at the centre and the others clear of each other, largest first', () => {
    const [cell] = layoutCells(
      [
        { id: 'small', u: 2, v: 2, ...sizeCircle(1) },
        { id: 'large', u: 2, v: 2, ...sizeCircle(13) },
        { id: 'medium', u: 2, v: 2, ...sizeCircle(5) },
      ],
      MIN_CELL_SIZE,
    );
    const circles = cell?.circles ?? [];

    expect(circles.map((circle) => circle.id)).toStrictEqual(['large', 'medium', 'small']);
    expect(circles[0]).toMatchObject({ cx: MIN_CELL_SIZE / 2, cy: MIN_CELL_SIZE / 2 });
    for (const [index, circle] of circles.entries()) {
      const later = circles.slice(index + 1);
      for (const other of later) {
        expect(Math.hypot(circle.cx - other.cx, circle.cy - other.cy)).toBeGreaterThanOrEqual(circle.r + other.r);
      }
    }
  });

  it('packs clear of each other in a larger cell the circles that overlap in the smallest one', () => {
    const placements = Array.from({ length: 12 }, (_, index) => ({ id: String(index), u: 3, v: 4, ...sizeCircle(13) }));

    expect(hasOverlap(layoutCells(placements, MIN_CELL_SIZE)[0]?.circles ?? [])).toBe(true);
    expect(hasOverlap(layoutCells(placements, MIN_CELL_SIZE * 2.5)[0]?.circles ?? [])).toBe(false);
  });

  it('lets a larger gutter cell list more rows before its list overflows', () => {
    const placements = Array.from({ length: ROWS_THAT_FIT + 1 }, (_, index) => ({ id: String(index), u: 0, v: 0 }));

    expect(layoutCells(placements, MIN_CELL_SIZE * 2)[0]?.overflow).toBe(false);
  });

  it('when a placement has no radius, draws it at one point and marks it unsized', () => {
    const [cell] = layoutCells([{ id: 'a', u: 1, v: 1 }], MIN_CELL_SIZE);

    expect(cell?.circles[0]).toMatchObject({ r: RADIUS_PER_POINT, isUnsized: true });
  });

  it('if a placement is outside the grid, throws a RangeError', () => {
    expect(() => layoutCells([{ id: 'a', u: GRID_SIZE, v: 0 }], MIN_CELL_SIZE)).toThrow(RangeError);
  });
});

describe(placeGhosts, () => {
  it('places a ghost clear of the circles in its cell and leaves them where they were', () => {
    const cells = layoutCells(
      [
        { id: 'a', u: 3, v: 3, r: 20 },
        { id: 'b', u: 3, v: 3, r: 10 },
      ],
      MIN_CELL_SIZE,
    );
    const before = structuredClone(cells);

    const [ghost] = placeGhosts(cells, [{ id: 'g', u: 3, v: 3, r: 10 }], MIN_CELL_SIZE);

    expect(cells).toStrictEqual(before);
    const [cell] = cells;
    if (!ghost || !cell) throw new Error('expected a ghost and a cell');
    expect(ghost).toMatchObject({ id: 'g', r: 10 });
    for (const circle of cell.circles) {
      const distance = Math.hypot(ghost.x - (cell.x + circle.cx), ghost.y - (cell.y + circle.cy));
      expect(distance).toBeGreaterThanOrEqual(circle.r + ghost.r);
    }
  });

  it('keeps two ghosts in one cell clear of each other', () => {
    const [first, second] = placeGhosts(
      layoutCells([{ id: 'a', u: 2, v: 2, r: 20 }], MIN_CELL_SIZE),
      [
        { id: 'g', u: 2, v: 2, r: 10 },
        { id: 'h', u: 2, v: 2, r: 10 },
      ],
      MIN_CELL_SIZE,
    );

    if (!first || !second) throw new Error('expected two ghosts');
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(20);
  });

  it('centres a ghost in a cell that holds no circle, unsized at one point when it has no radius', () => {
    expect(placeGhosts([], [{ id: 'g', u: 4, v: 4 }], MIN_CELL_SIZE)).toStrictEqual([
      { id: 'g', x: 4 * MIN_CELL_SIZE + MIN_CELL_SIZE / 2, y: MIN_CELL_SIZE / 2, r: RADIUS_PER_POINT, isUnsized: true },
    ]);
  });
});

describe(placeItems, () => {
  const at = '2026-11-01T09:00:00.000Z';
  const item: WorkItem = {
    repo: 'williamthorsen/top-right',
    number: 1,
    title: 'Issue 1',
    url: 'https://github.com/williamthorsen/top-right/issues/1',
    state: 'open',
    createdAt: at,
    labels: [],
    relations: [],
  };

  it('places an item by its scores and sizes it in the given mode', () => {
    const scores: Record<string, ItemScores> = {
      'williamthorsen/top-right#1': {
        urgency: { score: 'critical', by: 'author', at },
        effort: { score: 8, by: 'author', at },
        progress: { score: 0.5, by: 'author', at },
      },
    };

    expect(placeItems([item], scores, 'remaining')).toStrictEqual([
      { id: 'williamthorsen/top-right#1', u: 4, v: 0, ...sizeCircle(4) },
    ]);
  });
});

describe(sizeCircle, () => {
  it('gives a circle an area proportional to its points', () => {
    expect(sizeCircle(4)).toStrictEqual({ r: 2 * RADIUS_PER_POINT, isUnsized: false });
    expect(sizeCircle(1).r ** 2 * 9).toBeCloseTo(sizeCircle(9).r ** 2);
  });

  it('draws an unsized item at one point, marked as unsized', () => {
    expect(sizeCircle(undefined)).toStrictEqual({ r: RADIUS_PER_POINT, isUnsized: true });
  });

  it('raises a circle smaller than the minimum radius to it, unmarked', () => {
    expect(sizeCircle(0.5)).toStrictEqual({ r: FLOOR_RADIUS, isUnsized: false });
  });
});

describe(sizeItem, () => {
  const at = '2026-11-01T09:00:00.000Z';
  const halfDone: ItemScores = { effort: { score: 8, by: 'author', at }, progress: { score: 0.5, by: 'author', at } };

  it('sizes original scope from the effort', () => {
    expect(sizeItem(halfDone, 'original')).toStrictEqual(sizeCircle(8));
  });

  it('sizes remaining scope on the same area scale', () => {
    expect(sizeItem(halfDone, 'remaining')).toStrictEqual(sizeCircle(4));
  });

  it('draws finished work at the minimum radius at remaining scope, unmarked', () => {
    const done: ItemScores = { ...halfDone, progress: { score: 1, by: 'author', at } };

    expect(sizeItem(done, 'remaining')).toStrictEqual({ r: FLOOR_RADIUS, isUnsized: false });
  });

  it('draws an item without effort at one point, unsized, in both modes', () => {
    expect(sizeItem(undefined, 'original')).toStrictEqual({ r: RADIUS_PER_POINT, isUnsized: true });
    expect(sizeItem({ progress: { score: 0.5, by: 'author', at } }, 'remaining')).toStrictEqual({
      r: RADIUS_PER_POINT,
      isUnsized: true,
    });
  });
});

// region | Helpers
/** Returns whether any two of the circles overlap. */
function hasOverlap(circles: ReadonlyArray<{ cx: number; cy: number; r: number }>): boolean {
  return circles.some((circle, index) =>
    circles
      .slice(index + 1)
      .some((other) => Math.hypot(circle.cx - other.cx, circle.cy - other.cy) < circle.r + other.r),
  );
}
// endregion | Helpers
