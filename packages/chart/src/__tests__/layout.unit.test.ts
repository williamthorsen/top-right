import type { ItemScores, WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import {
  CELL_PADDING,
  CELL_SIZE,
  findScoredCellAt,
  FLOOR_RADIUS,
  GRID_SIZE,
  GUTTER_ROW_PITCH,
  layoutCells,
  placeGhosts,
  placeItems,
  RADIUS_PER_POINT,
  sizeCircle,
  sizeItem,
} from '../layout.ts';

/** The most rows that fit a gutter cell, derived from the geometry. */
const ROWS_THAT_FIT = Math.floor((CELL_SIZE - 2 * CELL_PADDING) / GUTTER_ROW_PITCH);

describe(findScoredCellAt, () => {
  it('returns the scored cell that contains an interior point', () => {
    expect(findScoredCellAt(CELL_SIZE * 2.5, CELL_SIZE * 0.5)).toStrictEqual({ u: 2, i: 5 });
    expect(findScoredCellAt(CELL_SIZE * 5.5, CELL_SIZE * 4.5)).toStrictEqual({ u: 5, i: 1 });
  });

  it('gives a point on a shared edge to the cell to its right or below it', () => {
    expect(findScoredCellAt(CELL_SIZE * 3, CELL_SIZE * 2)).toStrictEqual({ u: 3, i: 3 });
  });

  it.each([
    { case: 'the unscored-urgency column', x: CELL_SIZE * 0.5, y: CELL_SIZE * 2.5 },
    { case: 'the unscored-impact row', x: CELL_SIZE * 2.5, y: CELL_SIZE * 5.5 },
    { case: 'left of the matrix', x: -1, y: CELL_SIZE * 2.5 },
    { case: 'above the matrix', x: CELL_SIZE * 2.5, y: -1 },
    { case: 'on the far right edge', x: CELL_SIZE * GRID_SIZE, y: CELL_SIZE * 2.5 },
    { case: 'on the far bottom edge', x: CELL_SIZE * 2.5, y: CELL_SIZE * GRID_SIZE },
  ])('returns undefined for a point in $case', ({ x, y }) => {
    expect(findScoredCellAt(x, y)).toBeUndefined();
  });
});

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

describe(placeGhosts, () => {
  it('places a ghost clear of the circles in its cell and leaves them where they were', () => {
    const cells = layoutCells([
      { id: 'a', u: 3, i: 3, r: 20 },
      { id: 'b', u: 3, i: 3, r: 10 },
    ]);
    const before = structuredClone(cells);

    const [ghost] = placeGhosts(cells, [{ id: 'g', u: 3, i: 3, r: 10 }]);

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
    const [first, second] = placeGhosts(layoutCells([{ id: 'a', u: 2, i: 2, r: 20 }]), [
      { id: 'g', u: 2, i: 2, r: 10 },
      { id: 'h', u: 2, i: 2, r: 10 },
    ]);

    if (!first || !second) throw new Error('expected two ghosts');
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(20);
  });

  it('centres a ghost in a cell that holds no circle, at the floor when it has no radius', () => {
    expect(placeGhosts([], [{ id: 'g', u: 5, i: 5 }])).toStrictEqual([
      { id: 'g', x: 5 * CELL_SIZE + CELL_SIZE / 2, y: CELL_SIZE / 2, r: FLOOR_RADIUS },
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
        urgency: { value: 4, by: 'author', at },
        effort: { value: 8, by: 'author', at },
        progress: { value: 0.5, by: 'author', at },
      },
    };

    expect(placeItems([item], scores, 'remaining')).toStrictEqual([
      { id: 'williamthorsen/top-right#1', u: 4, i: 0, ...sizeCircle(4) },
    ]);
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

describe(sizeItem, () => {
  const at = '2026-11-01T09:00:00.000Z';
  const halfDone: ItemScores = { effort: { value: 8, by: 'author', at }, progress: { value: 0.5, by: 'author', at } };

  it('sizes original scope from the effort', () => {
    expect(sizeItem(halfDone, 'original')).toStrictEqual(sizeCircle(8));
  });

  it('sizes remaining scope on the same area scale', () => {
    expect(sizeItem(halfDone, 'remaining')).toStrictEqual(sizeCircle(4));
  });

  it('draws finished work at the floor at remaining scope', () => {
    const done: ItemScores = { ...halfDone, progress: { value: 1, by: 'author', at } };

    expect(sizeItem(done, 'remaining')).toStrictEqual({ r: FLOOR_RADIUS, floored: true });
  });

  it('draws an item without effort at the floor in both modes', () => {
    expect(sizeItem(undefined, 'original')).toStrictEqual({ r: FLOOR_RADIUS, floored: true });
    expect(sizeItem({ progress: { value: 0.5, by: 'author', at } }, 'remaining')).toStrictEqual({
      r: FLOOR_RADIUS,
      floored: true,
    });
  });
});
