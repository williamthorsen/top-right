import { URGENCY_LEVELS, VALUE_LEVELS } from '@top-right/model';

import { CALLOUT_GAP, CALLOUT_PITCH } from './callout-layout.ts';
import { MARGIN_RIGHT } from './Grid.tsx';
import { type CellLayout, GRID_SIZE, type PlacedCircle } from './layout.ts';
import { LEVEL_NAMES } from './level-names.ts';

/** The room, in chart units at 1×, that the fit reserves beside the matrix while titles show. */
export const TITLE_LANE_WIDTH = 280;
/** The narrowest lane that shows; with less room the titles do not show. */
export const MIN_TITLE_LANE_WIDTH = 160;
/** The space between two of the lane's sections. */
export const TITLE_SECTION_GAP = 8;

/** One row of the lane: a section's heading, an item's title, or a section's count of the items without a row. */
export type TitleRow =
  | { kind: 'heading'; key: string; label: string; y: number; hasGap: boolean }
  | {
      kind: 'item';
      id: string;
      /** The row's vertical centre, where its leader meets the lane. */
      y: number;
      /** The leader's start, on the circle's right edge. */
      from: { x: number; y: number };
    }
  | { kind: 'more'; key: string; count: number; y: number };

/** The titles lane, in matrix units: a column right of the frame, as tall as the matrix. */
export interface TitleLaneLayout {
  x: number;
  width: number;
  rows: TitleRow[];
}

export interface TitleLaneOptions {
  cells: readonly CellLayout[];
  cellSize: number;
  /** The room right of the frame's edge, in chart units. */
  roomWidth: number;
  selectedKey?: string | undefined;
  /** The items related to the selected item. */
  relatedKeys?: ReadonlySet<string> | undefined;
  /** The scored cell to which the lane narrows. */
  narrowedCell?: { u: number; v: number } | undefined;
}

/**
 * Lays out the titles of the scored items in one lane right of the frame, or returns undefined when the room is
 * narrower than `MIN_TITLE_LANE_WIDTH`. The lane has a section per urgency, most urgent first, whose rows follow their
 * circles from top to bottom. When the rows do not all fit the matrix's height, they are chosen by rank: the selected
 * item, its related items, then nearness to the top-right corner, then larger circles. Every section keeps its heading,
 * and one that withholds items ends with their count. A narrowed lane holds one cell's items, after the selected item
 * when the cell does not hold it.
 */
export function layoutTitleLane(options: TitleLaneOptions): TitleLaneLayout | undefined {
  const { cells, cellSize, roomWidth, selectedKey, relatedKeys, narrowedCell } = options;
  const width = roomWidth - CALLOUT_GAP;
  if (width < MIN_TITLE_LANE_WIDTH) return undefined;
  const matrixSize = cellSize * GRID_SIZE;

  const entries = cells
    .filter((cell) => !cell.isGutter)
    .flatMap((cell) => cell.circles.map((circle) => ({ cell, circle })));
  const scope = narrowedCell
    ? entries.filter(({ cell }) => cell.u === narrowedCell.u && cell.v === narrowedCell.v)
    : entries;
  const pinned =
    narrowedCell && scope.every(({ circle }) => circle.id !== selectedKey)
      ? entries.find(({ circle }) => circle.id === selectedKey)
      : undefined;
  const sections = [...new Set(scope.map(({ cell }) => cell.u))].toSorted((a, b) => b - a);

  const pinnedHeight = pinned ? 2 * CALLOUT_PITCH + TITLE_SECTION_GAP : 0;
  const shown: Entry[] = [];
  for (const entry of rankEntries(scope, selectedKey, relatedKeys)) {
    const next = [...shown, entry];
    if (pinnedHeight + measureSections(sections, scope, next) <= matrixSize) shown.push(entry);
  }

  const rows: TitleRow[] = [];
  let y = 0;
  function addRow(row: DistributiveOmit<TitleRow, 'y'>): void {
    rows.push({ ...row, y: y + CALLOUT_PITCH / 2 });
    y += CALLOUT_PITCH;
  }
  if (pinned) {
    addRow({ kind: 'heading', key: 'selected', label: 'Selected', hasGap: false });
    addRow(toItemRow(pinned));
    y += TITLE_SECTION_GAP;
  }
  for (const [index, u] of sections.entries()) {
    const hasGap = index > 0;
    if (hasGap) y += TITLE_SECTION_GAP;
    addRow({ kind: 'heading', key: `urgency-${u}`, label: formatSectionLabel(u, narrowedCell), hasGap });
    const sectionShown = shown.filter(({ cell }) => cell.u === u).toSorted(compareTopToBottom);
    for (const entry of sectionShown) addRow(toItemRow(entry));
    const count = scope.filter(({ cell }) => cell.u === u).length - sectionShown.length;
    if (count > 0) addRow({ kind: 'more', key: `more-${u}`, count });
  }

  return { x: matrixSize + MARGIN_RIGHT + CALLOUT_GAP, width, rows };
}

// region | Helpers
/** A scored item: its cell and its circle in the cell. */
interface Entry {
  cell: CellLayout;
  circle: PlacedCircle;
}

/** `Omit` applied to each member of a union, which keeps the union's discriminant. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Orders entries by their circles' position in the matrix, from top to bottom and then left to right. */
function compareTopToBottom(a: Entry, b: Entry): number {
  return a.cell.y + a.circle.cy - (b.cell.y + b.circle.cy) || a.cell.x + a.circle.cx - (b.cell.x + b.circle.cx);
}

/** Returns a section's heading: its urgency, and the narrowed cell's value. */
function formatSectionLabel(u: number, narrowedCell: { u: number; v: number } | undefined): string {
  const urgency = URGENCY_LEVELS[u - 1];
  const urgencyName = urgency ? `${LEVEL_NAMES[urgency]} urgency` : 'Urgency';
  const value = narrowedCell && VALUE_LEVELS[narrowedCell.v - 1];
  return value ? `${urgencyName} · ${LEVEL_NAMES[value]}` : urgencyName;
}

/** Returns the height of the sections' rows when `shown` have rows: headings, items, counts, and the gaps. */
function measureSections(sections: readonly number[], scope: readonly Entry[], shown: readonly Entry[]): number {
  const counted = sections.filter(
    (u) => scope.filter(({ cell }) => cell.u === u).length > shown.filter(({ cell }) => cell.u === u).length,
  ).length;
  const rowCount = sections.length + shown.length + counted;
  return rowCount * CALLOUT_PITCH + Math.max(0, sections.length - 1) * TITLE_SECTION_GAP;
}

/** Orders entries by rank: the selected item, its related items, nearness to the top-right corner, then size. */
function rankEntries(
  entries: readonly Entry[],
  selectedKey: string | undefined,
  relatedKeys: ReadonlySet<string> | undefined,
): Entry[] {
  const corner = GRID_SIZE - 1;
  function rankTier({ circle }: Entry): number {
    if (circle.id === selectedKey) return 0;
    return relatedKeys?.has(circle.id) ? 1 : 2;
  }
  function measureDistance({ cell }: Entry): number {
    return corner - cell.u + (corner - cell.v);
  }
  return entries.toSorted(
    (a, b) => rankTier(a) - rankTier(b) || measureDistance(a) - measureDistance(b) || b.circle.r - a.circle.r,
  );
}

/** Returns an entry's row, whose leader starts on its circle's right edge. */
function toItemRow({ cell, circle }: Entry): DistributiveOmit<TitleRow, 'y'> {
  return {
    kind: 'item',
    id: circle.id,
    from: { x: cell.x + circle.cx + circle.r, y: cell.y + circle.cy },
  };
}
// endregion | Helpers
