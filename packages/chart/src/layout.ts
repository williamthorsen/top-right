import {
  type Cell,
  computeRemainingScope,
  formatItemKey,
  rankLevel,
  type ResolvedItemScores,
  URGENCY_LEVELS,
  VALUE_LEVELS,
  type WorkItem,
} from '@top-right/model';

// -- Geometry, in chart units at 1× --

export const CELL_SIZE = 120;
/** Cells per axis: the gutter at index 0, then each level at its rank, 1 to 4. */
export const GRID_SIZE = 5;
/** The smallest legible circle radius. */
export const FLOOR_RADIUS = 6.5;
/** The height of one row of a gutter cell's list, which `.tr-item` matches; 24 meets the WCAG 2.2 target size. */
export const GUTTER_ROW_PITCH = 24;
export const CELL_PADDING = 10;
export const CIRCLE_GAP = 2;
/** The radius of one point of effort; area grows with effort, so a circle's radius is `RADIUS_PER_POINT × √effort`. */
export const RADIUS_PER_POINT = 7;
/** How far inside its cell's edge a packed circle stays. */
const CELL_INSET = 3;
/** The step, in degrees, between the tangent positions that the packing tries around each placed circle. */
const TANGENT_STEP_DEGREES = 10;
/** The angle, in radians, between successive places on an overfull cell's inner ring. */
const RING_STEP = 2.4;

/** A circle's radius, and whether the floor raised it. */
export interface CircleSize {
  r: number;
  floored: boolean;
}

const FLOOR_SIZE: CircleSize = { r: FLOOR_RADIUS, floored: true };

/** Which scope a circle's area shows. */
export type ScopeMode = 'original' | 'remaining';

/** An item's cell: `u` is its urgency column and `v` its value row, each its level's rank, or 0 when unscored. */
export interface Placement {
  id: string;
  u: number;
  v: number;
  /** The circle's radius; the floor when absent. */
  r?: number;
  /** Whether the radius is the floor rather than the item's scope; true when `r` is absent. */
  floored?: boolean;
}

export interface PlacedCircle {
  id: string;
  /** The centre, relative to the cell's top-left corner. */
  cx: number;
  cy: number;
  r: number;
  floored: boolean;
}

export interface CellLayout {
  u: number;
  v: number;
  /** The cell's top-left corner in the matrix, whose origin is the top-left of the must-have row. */
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

/**
 * Returns the scored cell that contains a point in matrix units, or undefined for a point in a gutter or off the matrix.
 * A point on a shared edge belongs to the cell to its right or below it.
 */
export function findScoredCellAt(x: number, y: number): { u: number; v: number } | undefined {
  const u = Math.floor(x / CELL_SIZE);
  const v = GRID_SIZE - 1 - Math.floor(y / CELL_SIZE);
  if (u < 1 || u >= GRID_SIZE || v < 1 || v >= GRID_SIZE) return undefined;
  return { u, v };
}

/** Returns the levels of the scored cell at column `u` and row `v`, or undefined for a gutter or off the matrix. */
export function findCellLevels(u: number, v: number): Cell | undefined {
  const urgency = URGENCY_LEVELS[u - 1];
  const value = VALUE_LEVELS[v - 1];
  return urgency && value ? { urgency, value } : undefined;
}

/** Returns the cell of an item's scores: each axis its level's rank, or 0 when unscored. */
export function findItemCell(scores: ResolvedItemScores | undefined): { u: number; v: number } {
  const urgency = scores?.urgency?.score;
  const value = scores?.value?.score;
  return { u: urgency === undefined ? 0 : rankLevel(urgency), v: value === undefined ? 0 : rankLevel(value) };
}

/** Groups placements into the cells that they occupy and lays out each cell's contents, in matrix order. */
export function layoutCells(placements: readonly Placement[]): CellLayout[] {
  const cells = new Map<string, CellLayout>();
  const sizes = new Map<string, CircleSize>();
  for (const placement of placements) {
    sizes.set(placement.id, {
      r: placement.r ?? FLOOR_RADIUS,
      floored: placement.floored ?? placement.r === undefined,
    });
    const key = `${placement.u},${placement.v}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = createCell(placement.u, placement.v);
      cells.set(key, cell);
    }
    cell.ids.push(placement.id);
  }
  for (const cell of cells.values()) {
    if (cell.isGutter) cell.overflow = cell.ids.length * GUTTER_ROW_PITCH + 2 * CELL_PADDING > CELL_SIZE;
    else cell.circles = packCircles(cell.ids.map((id) => ({ id, ...(sizes.get(id) ?? FLOOR_SIZE) })));
  }
  return cells
    .values()
    .toArray()
    .toSorted((a, b) => b.v - a.v || a.u - b.u);
}

/** A ghost's circle in the matrix: its centre, in matrix units, and its radius. */
export interface GhostPlacement {
  id: string;
  x: number;
  y: number;
  r: number;
}

/**
 * Places a ghost for each placement in its scored cell, after the circles that `cells` already packs there and any
 * earlier ghost in the same cell, so that a ghost never moves a circle; `cells` is left unchanged.
 */
export function placeGhosts(cells: readonly CellLayout[], placements: readonly Placement[]): GhostPlacement[] {
  const occupants = new Map<string, { cell: CellLayout; placed: PlacedCircle[] }>(
    cells.map((cell) => [`${cell.u},${cell.v}`, { cell, placed: [...cell.circles] }]),
  );
  return placements.map((placement) => {
    const key = `${placement.u},${placement.v}`;
    let occupant = occupants.get(key);
    if (!occupant) {
      occupant = { cell: createCell(placement.u, placement.v), placed: [] };
      occupants.set(key, occupant);
    }
    const { cell, placed } = occupant;
    const r = placement.r ?? FLOOR_RADIUS;
    const limit = Math.max(0, CELL_SIZE / 2 - r - CELL_INSET);
    const offset =
      placed.length === 0 ? { x: 0, y: 0 } : (findTangentOffset(r, limit, placed) ?? ringOffset(placed.length, limit));
    const circle = {
      id: placement.id,
      cx: CELL_SIZE / 2 + offset.x,
      cy: CELL_SIZE / 2 + offset.y,
      r,
      floored: placement.floored ?? placement.r === undefined,
    };
    placed.push(circle);
    return { id: circle.id, x: cell.x + circle.cx, y: cell.y + circle.cy, r };
  });
}

/** Returns each item's placement: its cell from its scores, each axis 0 when unscored, and its size in `mode`. */
export function placeItems(
  items: readonly WorkItem[],
  scores: Readonly<Record<string, ResolvedItemScores>>,
  mode: ScopeMode,
): Placement[] {
  return items.map((item) => {
    const id = formatItemKey(item);
    const itemScores = scores[id];
    return { id, ...findItemCell(itemScores), ...sizeItem(itemScores, mode) };
  });
}

/** Returns the radius of a circle whose scope is `points`, raised to the floor when it is smaller or absent. */
export function sizeCircle(points: number | undefined): CircleSize {
  if (points === undefined) return FLOOR_SIZE;
  const r = RADIUS_PER_POINT * Math.sqrt(points);
  return r < FLOOR_RADIUS ? FLOOR_SIZE : { r, floored: false };
}

/** Returns the radius of an item's circle for the scope that `mode` shows, on the one area scale of `sizeCircle`. */
export function sizeItem(scores: ResolvedItemScores | undefined, mode: ScopeMode): CircleSize {
  return sizeCircle(mode === 'remaining' ? computeRemainingScope(scores) : scores?.effort?.score);
}

// region | Helpers
function assertIndex(value: number, axis: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= GRID_SIZE) {
    throw new RangeError(`${axis} must be an integer from 0 to ${GRID_SIZE - 1}; got ${value}`);
  }
}

function createCell(u: number, v: number): CellLayout {
  assertIndex(u, 'urgency');
  assertIndex(v, 'value');
  return {
    u,
    v,
    x: u * CELL_SIZE,
    y: (GRID_SIZE - 1 - v) * CELL_SIZE,
    isGutter: u === 0 || v === 0,
    ids: [],
    overflow: false,
    circles: [],
  };
}

/**
 * Packs a cell's circles greedily: the largest at the centre, each next at the clear tangent position nearest the
 * centre. A circle for which no clear position remains takes a place on the cell's inner ring, overlapping its
 * neighbours but never leaving the cell. Circles come back largest first, the order in which they draw.
 */
function packCircles(members: ReadonlyArray<CircleSize & { id: string }>): PlacedCircle[] {
  const ordered = members.toSorted((a, b) => b.r - a.r || a.id.localeCompare(b.id));
  const placed: PlacedCircle[] = [];
  for (const [index, member] of ordered.entries()) {
    const limit = Math.max(0, CELL_SIZE / 2 - member.r - CELL_INSET);
    const offset =
      index === 0 ? { x: 0, y: 0 } : (findTangentOffset(member.r, limit, placed) ?? ringOffset(index, limit));
    placed.push({ ...member, cx: CELL_SIZE / 2 + offset.x, cy: CELL_SIZE / 2 + offset.y });
  }
  return placed;
}

/** Returns the clear position tangent to a placed circle that lies nearest the centre, within `limit` of it. */
function findTangentOffset(
  r: number,
  limit: number,
  placed: readonly PlacedCircle[],
): { x: number; y: number } | undefined {
  let best: { x: number; y: number; distance: number } | undefined;
  for (const other of placed) {
    const reach = other.r + r + CIRCLE_GAP;
    for (let degrees = 0; degrees < 360; degrees += TANGENT_STEP_DEGREES) {
      const angle = (degrees * Math.PI) / 180;
      const x = other.cx - CELL_SIZE / 2 + Math.cos(angle) * reach;
      const y = other.cy - CELL_SIZE / 2 + Math.sin(angle) * reach;
      if (Math.abs(x) > limit || Math.abs(y) > limit) continue;
      const isClear = placed.every(
        (neighbour) =>
          Math.hypot(x - (neighbour.cx - CELL_SIZE / 2), y - (neighbour.cy - CELL_SIZE / 2)) >=
          neighbour.r + r + CIRCLE_GAP - 0.01,
      );
      const distance = Math.hypot(x, y);
      if (isClear && (!best || distance < best.distance)) best = { x, y, distance };
    }
  }
  return best && { x: best.x, y: best.y };
}

function ringOffset(index: number, limit: number): { x: number; y: number } {
  const angle = index * RING_STEP;
  return { x: Math.cos(angle) * limit, y: Math.sin(angle) * limit };
}
// endregion | Helpers
