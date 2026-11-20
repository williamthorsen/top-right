import type { RelationGraph } from '@top-right/model';
import { type RefObject, useMemo, useState } from 'react';

import type { CellCallouts } from './callout-layout.ts';
import { focusItem } from './Edges.tsx';
import { arrangeHoverAids } from './hover-aids.ts';
import type { CellLayout } from './layout.ts';
import type { TitleLaneView } from './TitleLane.tsx';
import { useCellHover } from './useCellHover.ts';
import { useHeldCell } from './useHeldCell.ts';

export interface TitleLaneHookOptions {
  scrollRef: RefObject<HTMLElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  cells: readonly CellLayout[];
  cellSize: number;
  /** The chart area's spare room on each side of a centred frame, in chart units. */
  spareWidth: number;
  graph: RelationGraph;
  showTitles: boolean;
  showLines: boolean;
  selectedKey: string | undefined;
  /** The item of the hovered row or circle. */
  hoveredKey: string | undefined;
  onHighlight: (key: string | undefined) => void;
  onSelect: (key: string) => void;
}

/** What names the items beside the matrix while a pointer rests on a cell or Titles is on. */
export interface TitleLaneState {
  /** The hovered cell's callouts, which decide the fade whether or not their column shows. */
  hoveredCallouts: CellCallouts | undefined;
  /** The callouts whose column shows. */
  callouts: CellCallouts | undefined;
  /** The titles lane, while Titles is on and the area has room for it. */
  titleLane: TitleLaneView | undefined;
}

/**
 * Tracks the hovered cell and the pointer's resting on the titles lane, and arranges the callouts and the lane from
 * them: a rested scored cell narrows the lane, which the pointer's reaching the lane keeps narrowed.
 */
export function useTitleLane(options: TitleLaneHookOptions): TitleLaneState {
  const { scrollRef, svgRef, cells, cellSize, spareWidth, graph, showTitles, showLines, selectedKey } = options;
  const relatedKeys = useMemo(() => focusItem(graph, selectedKey, false).related, [graph, selectedKey]);
  const hoveredCell = useCellHover({ scrollRef, svgRef, cellSize });
  const [isOverLane, setIsOverLane] = useState(false);
  const circledCell = cells.find(
    (cell) => !cell.isGutter && cell.circles.length > 0 && cell.u === hoveredCell?.u && cell.v === hoveredCell.v,
  );
  const narrowingCell = useHeldCell(circledCell, isOverLane);
  const { hoveredCallouts, callouts, titleLayout } = arrangeHoverAids({
    cells,
    cellSize,
    spareWidth,
    hoveredCell,
    narrowingCell,
    showTitles,
    selectedKey,
    relatedKeys,
  });
  // A lane that unmounts under the pointer reports no pointer-leave, so its hold ends with it.
  if (isOverLane && !titleLayout) setIsOverLane(false);
  const titleLane = titleLayout && {
    layout: titleLayout,
    showsAllLeaders: showLines,
    selectedKey,
    hoveredKey: options.hoveredKey,
    onHighlight: options.onHighlight,
    onSelect: options.onSelect,
    onPointerOverChange: setIsOverLane,
  };
  return { hoveredCallouts, callouts, titleLane };
}
