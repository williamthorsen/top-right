import { describe, expect, it } from 'vitest';

import { CALLOUT_GAP, CALLOUT_PITCH, layoutCallouts } from '../callout-layout.ts';
import { MARGIN_LEFT, MARGIN_RIGHT } from '../Grid.tsx';
import { type CellLayout, GRID_SIZE, layoutCells, MIN_CELL_SIZE } from '../layout.ts';

const MATRIX_SIZE = MIN_CELL_SIZE * GRID_SIZE;
/** The most rows that the column fits, derived from the geometry. */
const CAPACITY = Math.floor(MATRIX_SIZE / CALLOUT_PITCH);

describe(layoutCallouts, () => {
  it.each([
    { u: 1, side: 'right' },
    { u: 2, side: 'right' },
    { u: 3, side: 'left' },
    { u: 4, side: 'left' },
  ])('puts the column of column $u on the $side', ({ u, side }) => {
    expect(layoutCallouts(buildCell(u, 4, 1), MIN_CELL_SIZE).side).toBe(side);
  });

  it('runs a right column from beside the cell to the frame edge', () => {
    const cell = buildCell(2, 3, 1);
    const callouts = layoutCallouts(cell, MIN_CELL_SIZE);

    expect(callouts.x).toBe(cell.x + MIN_CELL_SIZE + CALLOUT_GAP);
    expect(callouts.x + callouts.width).toBe(MATRIX_SIZE + MARGIN_RIGHT);
  });

  it('runs a left column from beside the cell to the frame edge, over the gutter column', () => {
    const cell = buildCell(3, 3, 1);
    const callouts = layoutCallouts(cell, MIN_CELL_SIZE);

    expect(callouts.x).toBe(cell.x - CALLOUT_GAP);
    expect(callouts.x - callouts.width).toBe(-MARGIN_LEFT);
  });

  it('orders the rows by circle from top to bottom and starts the column at the cell top', () => {
    const cell = buildCell(1, 4, 6);
    const callouts = layoutCallouts(cell, MIN_CELL_SIZE);
    const byTop = cell.circles.toSorted((a, b) => a.cy - b.cy || a.cx - b.cx).map((circle) => circle.id);

    expect(callouts.rows.map((row) => row.id)).toStrictEqual(byTop);
    expect(callouts.top).toBe(cell.y);
  });

  it('joins each row to its circle at the edge that faces the column', () => {
    const cell = buildCell(4, 4, 1);
    const [circle] = cell.circles;
    const [row] = layoutCallouts(cell, MIN_CELL_SIZE).rows;

    expect(row?.from).toStrictEqual({
      x: cell.x + (circle?.cx ?? 0) - (circle?.r ?? 0),
      y: cell.y + (circle?.cy ?? 0),
    });
  });

  it('shifts the column up so that its last row ends at the matrix bottom', () => {
    const callouts = layoutCallouts(buildCell(2, 1, 16), MIN_CELL_SIZE);

    expect(callouts.top + callouts.rows.length * CALLOUT_PITCH).toBe(MATRIX_SIZE);
  });

  it('keeps every row a pitch apart, so that none overlaps the next', () => {
    const { rows } = layoutCallouts(buildCell(3, 2, 20), MIN_CELL_SIZE);
    const gaps = rows.slice(1).map((row, index) => row.y - (rows[index]?.y ?? 0));

    expect(gaps.every((gap) => gap === CALLOUT_PITCH)).toBe(true);
  });

  it('counts the circles that do not fit in a last row, within the matrix', () => {
    const callouts = layoutCallouts(buildCell(1, 2, CAPACITY + 5), MIN_CELL_SIZE);

    expect(callouts.rows).toHaveLength(CAPACITY - 1);
    expect(callouts.overflow).toBe(6);
    expect(callouts.top).toBeGreaterThanOrEqual(0);
  });

  it('counts nothing when every circle fits', () => {
    expect(layoutCallouts(buildCell(1, 2, CAPACITY), MIN_CELL_SIZE).overflow).toBe(0);
  });
});

// region | Helpers
/** Returns the laid-out scored cell at column `u` and row `v` holding `count` unsized circles. */
function buildCell(u: number, v: number, count: number): CellLayout {
  const placements = Array.from({ length: count }, (_, index) => ({ id: `item-${index}`, u, v }));
  const [cell] = layoutCells(placements, MIN_CELL_SIZE);
  if (!cell) throw new Error('layoutCells returned no cell');
  return cell;
}
// endregion | Helpers
