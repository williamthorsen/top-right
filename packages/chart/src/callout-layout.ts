import { MARGIN_LEFT, MARGIN_RIGHT } from './Grid.tsx';
import { type CellLayout, GRID_SIZE } from './layout.ts';

/** The height of one callout row, in chart units, which `.tr-callout` matches. */
export const CALLOUT_PITCH = 17;
/** The space between a cell's edge and its callout column. */
export const CALLOUT_GAP = 10;

/** One circle's callout: its row and the leader that joins the row to the circle. */
export interface CalloutRow {
  id: string;
  /** The row's vertical centre, in matrix units, where the leader meets the column. */
  y: number;
  /** The leader's start, on the circle's edge that faces the column. */
  from: { x: number; y: number };
}

/** The callout column of one cell, in matrix units. */
export interface CalloutLayout {
  side: 'left' | 'right';
  /** The column's edge nearest the cell, where every leader ends. */
  x: number;
  width: number;
  top: number;
  rows: CalloutRow[];
  /** How many circles lack a row, which the column's last row counts; 0 when every circle has one. */
  overflow: number;
}

/**
 * Lays out a scored cell's callouts as one column beside the cell, on the side with at least two cells of room: one row
 * per circle from top to bottom, clamped to the matrix's bottom edge, with a last row that counts the circles for which
 * the matrix's height has no room.
 */
export function layoutCallouts(cell: CellLayout, cellSize: number): CalloutLayout {
  const matrixSize = cellSize * GRID_SIZE;
  const side = cell.u <= 2 ? 'right' : 'left';
  const x = side === 'right' ? cell.x + cellSize + CALLOUT_GAP : cell.x - CALLOUT_GAP;
  const width = side === 'right' ? matrixSize + MARGIN_RIGHT - x : x + MARGIN_LEFT;

  const circles = cell.circles.toSorted((a, b) => a.cy - b.cy || a.cx - b.cx);
  const capacity = Math.floor(matrixSize / CALLOUT_PITCH);
  const shown = circles.length > capacity ? circles.slice(0, capacity - 1) : circles;
  const overflow = circles.length - shown.length;
  const rowCount = shown.length + (overflow > 0 ? 1 : 0);
  const top = Math.min(cell.y, matrixSize - rowCount * CALLOUT_PITCH);

  const rows = shown.map((circle, index) => ({
    id: circle.id,
    y: top + (index + 0.5) * CALLOUT_PITCH,
    from: { x: cell.x + circle.cx + (side === 'right' ? circle.r : -circle.r), y: cell.y + circle.cy },
  }));
  return { side, x, width, top, rows, overflow };
}
