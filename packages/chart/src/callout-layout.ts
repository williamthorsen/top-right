import { MARGIN_LEFT, MARGIN_RIGHT } from './Grid.tsx';
import { type CellLayout, GRID_SIZE } from './layout.ts';

/** The height of one callout row, in chart units, which `.tr-callout` matches. */
export const CALLOUT_PITCH = 17;
/** The space between a cell's edge and its callout column. */
export const CALLOUT_GAP = 10;

/** One item's callout: its row and, for a circle, the leader that joins the row to the circle. */
export interface CalloutRow {
  id: string;
  /** The row's vertical centre, in matrix units, where a leader meets the column. */
  y: number;
  /** The leader's start, on the circle's edge that faces the column; a gutter row has no leader. */
  from?: { x: number; y: number };
}

/** The callout column of one cell, in matrix units. */
export interface CalloutLayout {
  side: 'left' | 'right';
  /** The column's edge nearest the cell, where every leader ends. */
  x: number;
  width: number;
  top: number;
  rows: CalloutRow[];
  /** How many items lack a row, which the column's last row counts; 0 when every item has one. */
  overflow: number;
}

/** A hovered cell with its callout column. */
export interface CellCallouts {
  cell: CellLayout;
  layout: CalloutLayout;
}

/** Returns the callouts of the hovered cell among `cells`, or undefined when that cell holds no item. */
export function findCellCallouts(
  cells: readonly CellLayout[],
  hovered: { u: number; v: number } | undefined,
  cellSize: number,
  spareWidth = 0,
): CellCallouts | undefined {
  const cell = cells.find(
    (each) =>
      (each.isGutter ? each.ids.length : each.circles.length) > 0 && each.u === hovered?.u && each.v === hovered.v,
  );
  return cell && { cell, layout: layoutCallouts(cell, cellSize, spareWidth) };
}

/**
 * Lays out a cell's callouts as one column beside the cell, on the side with at least two cells of room, clamped to the
 * matrix's bottom edge, with a last row that counts the items for which the matrix's height has no room. A scored cell
 * has one row per circle from top to bottom, each with a leader; a gutter cell has one row per item in its list's order,
 * without leaders, because its rows move as the list scrolls. The column reaches past the frame's edge by `spareWidth`,
 * the chart area's spare room on each side of the frame.
 */
export function layoutCallouts(cell: CellLayout, cellSize: number, spareWidth = 0): CalloutLayout {
  const matrixSize = cellSize * GRID_SIZE;
  const side = cell.u <= 2 ? 'right' : 'left';
  const x = side === 'right' ? cell.x + cellSize + CALLOUT_GAP : cell.x - CALLOUT_GAP;
  const width = side === 'right' ? matrixSize + MARGIN_RIGHT + spareWidth - x : x + MARGIN_LEFT + spareWidth;

  const entries = cell.isGutter
    ? cell.ids.map((id) => ({ id }))
    : cell.circles
        .toSorted((a, b) => a.cy - b.cy || a.cx - b.cx)
        .map((circle) => ({
          id: circle.id,
          from: { x: cell.x + circle.cx + (side === 'right' ? circle.r : -circle.r), y: cell.y + circle.cy },
        }));
  const capacity = Math.floor(matrixSize / CALLOUT_PITCH);
  const shown = entries.length > capacity ? entries.slice(0, capacity - 1) : entries;
  const overflow = entries.length - shown.length;
  const rowCount = shown.length + (overflow > 0 ? 1 : 0);
  const top = Math.min(cell.y, matrixSize - rowCount * CALLOUT_PITCH);

  const rows = shown.map((entry, index) => ({ ...entry, y: top + (index + 0.5) * CALLOUT_PITCH }));
  return { side, x, width, top, rows, overflow };
}
