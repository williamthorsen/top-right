// -- Geometry, in chart units at 1× --

export const CELL_SIZE = 120;
/** Cells per axis: the gutter at index 0, then scores 1 to 5. */
export const GRID_SIZE = 6;
/** The smallest legible circle radius. */
export const FLOOR_RADIUS = 6.5;
/** The height of one row of a gutter cell's list. */
export const GUTTER_ROW_PITCH = 18;
export const CELL_PADDING = 10;
export const CIRCLE_GAP = 2;

/** An item's cell: `u` is its urgency column and `i` its impact row, each 0 (unscored) to 5. */
export interface Placement {
  id: string;
  u: number;
  i: number;
}

export interface PlacedCircle {
  id: string;
  /** The centre, relative to the cell's top-left corner. */
  cx: number;
  cy: number;
  r: number;
}

export interface CellLayout {
  u: number;
  i: number;
  /** The cell's top-left corner in the matrix, whose origin is the top-left of the impact-5 row. */
  x: number;
  y: number;
  isGutter: boolean;
  /** The cell's item ids, in placement order. */
  ids: string[];
  /** Whether a gutter cell's list is taller than the cell, so that the list scrolls within it. */
  overflow: boolean;
  /** The circles of a scored cell; a gutter cell lists its items instead. */
  circles: PlacedCircle[];
}

/** Groups placements into the cells that they occupy and lays out each cell's contents, in matrix order. */
export function layoutCells(placements: readonly Placement[]): CellLayout[] {
  const cells = new Map<string, CellLayout>();
  for (const placement of placements) {
    const key = `${placement.u},${placement.i}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = createCell(placement.u, placement.i);
      cells.set(key, cell);
    }
    cell.ids.push(placement.id);
  }
  for (const cell of cells.values()) {
    if (cell.isGutter) cell.overflow = cell.ids.length * GUTTER_ROW_PITCH + 2 * CELL_PADDING > CELL_SIZE;
    else cell.circles = packCircles(cell.ids);
  }
  return cells
    .values()
    .toArray()
    .toSorted((a, b) => b.i - a.i || a.u - b.u);
}

// region | Helpers
function assertIndex(value: number, axis: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= GRID_SIZE) {
    throw new RangeError(`${axis} must be an integer from 0 to ${GRID_SIZE - 1}; got ${value}`);
  }
}

function createCell(u: number, i: number): CellLayout {
  assertIndex(u, 'urgency');
  assertIndex(i, 'impact');
  return {
    u,
    i,
    x: u * CELL_SIZE,
    y: (GRID_SIZE - 1 - i) * CELL_SIZE,
    isGutter: u === 0 || i === 0,
    ids: [],
    overflow: false,
    circles: [],
  };
}

/** Packs floor-sized circles in a centred square grid. */
function packCircles(ids: readonly string[]): PlacedCircle[] {
  const columns = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / columns);
  const pitch = 2 * FLOOR_RADIUS + CIRCLE_GAP;
  const left = CELL_SIZE / 2 - ((columns - 1) * pitch) / 2;
  const top = CELL_SIZE / 2 - ((rows - 1) * pitch) / 2;
  return ids.map((id, index) => ({
    id,
    cx: left + (index % columns) * pitch,
    cy: top + Math.floor(index / columns) * pitch,
    r: FLOOR_RADIUS,
  }));
}
// endregion | Helpers
