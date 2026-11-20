import { type CellCallouts, findCellCallouts } from './callout-layout.ts';
import type { CellLayout } from './layout.ts';
import { layoutTitleLane, type TitleLaneLayout } from './title-lane.ts';

export interface HoverAidOptions {
  cells: readonly CellLayout[];
  cellSize: number;
  /** The chart area's spare room on each side of a centred frame, in chart units. */
  spareWidth: number;
  hoveredCell: { u: number; v: number } | undefined;
  /** The scored cell with circles to which the lane narrows, which outlasts its hover. */
  narrowingCell: { u: number; v: number } | undefined;
  showTitles: boolean;
  selectedKey: string | undefined;
  relatedKeys: ReadonlySet<string> | undefined;
}

/** What names the items beside the matrix: the hovered cell's callouts and the titles lane. */
export interface HoverAids {
  /** The hovered cell's callouts, which decide the fade whether or not their column shows. */
  hoveredCallouts: CellCallouts | undefined;
  /** The callouts whose column shows. */
  callouts: CellCallouts | undefined;
  /** The titles lane, while Titles is on and the area has room for it. */
  titleLayout: TitleLaneLayout | undefined;
}

/**
 * Arranges the hovered cell's callouts and the titles lane. The lane takes the room on both sides of a centred frame,
 * because the frame keeps to the area's left edge while the lane shows; the narrowing cell then narrows the lane, a
 * hovered scored cell shows no callout column, and a gutter cell's column stops at the frame's edge.
 */
export function arrangeHoverAids(options: HoverAidOptions): HoverAids {
  const { cells, cellSize, spareWidth, hoveredCell, narrowingCell, showTitles, selectedKey, relatedKeys } = options;
  const lane = { cells, cellSize, roomWidth: 2 * spareWidth, selectedKey, relatedKeys };
  const fullLayout = showTitles ? layoutTitleLane(lane) : undefined;
  const hoveredCallouts = findCellCallouts(cells, hoveredCell, cellSize, fullLayout ? 0 : spareWidth);
  const narrowedCell = fullLayout && cells.find((cell) => cell.u === narrowingCell?.u && cell.v === narrowingCell.v);
  return {
    hoveredCallouts,
    callouts: fullLayout && hoveredCallouts?.cell.isGutter === false ? undefined : hoveredCallouts,
    titleLayout: narrowedCell ? layoutTitleLane({ ...lane, narrowedCell }) : fullLayout,
  };
}
