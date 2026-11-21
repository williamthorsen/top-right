import type { RelationGraph, ResolvedItemScores, Scores, WorkItem } from '@top-right/model';
import { type RefObject, useMemo, useRef } from 'react';

import { type CellLayout, findCellLevels, layoutCells, placeItems, type ScopeMode } from './layout.ts';
import { TITLE_LANE_WIDTH } from './title-lane.ts';
import { type ItemDragState, useItemDrag } from './useItemDrag.ts';
import { usePan } from './usePan.ts';
import { type Pulse, usePulse } from './usePulse.ts';
import { useSelectionScroll } from './useSelectionScroll.ts';
import { type TitleLaneState, useTitleLane } from './useTitleLane.ts';
import { useZoom, type ZoomState } from './useZoom.ts';

export interface MatrixOptions {
  /** The element within which focus makes the zoom keys work. */
  keyRootRef: RefObject<HTMLElement | null>;
  items: readonly WorkItem[];
  scores: Readonly<Record<string, ResolvedItemScores>>;
  scopeMode: ScopeMode;
  graph: RelationGraph;
  magnification: number | undefined;
  onMagnificationChange: ((magnification: number) => void) | undefined;
  showTitles: boolean;
  showLines: boolean;
  selectedKey: string | undefined;
  /** The item of the hovered row or circle. */
  hoveredKey: string | undefined;
  onHighlight: (key: string | undefined) => void;
  /** Reports a select made in the matrix: a click on a circle or a title. */
  onSelect: (key: string) => void;
  /** Reports the scores of the cell on which the author drops an item. */
  onScoresChange: (key: string, scores: Scores) => void;
}

/** The matrix's drawing surface: its geometry at the current zoom, and the pointer's work on it. */
export interface Matrix extends Omit<ItemDragState, 'isHoldingPress'>, TitleLaneState {
  scrollRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  zoom: ZoomState;
  cells: CellLayout[];
  pulse: Pulse;
}

/**
 * Lays the items out in the matrix at the current zoom, and handles the pointer on it: the drag of the selected item,
 * the pan, the pulse and scroll of a selection, and the callouts and titles lane of the hovered cell.
 */
export function useMatrix(options: MatrixOptions): Matrix {
  const { items, scores, scopeMode, selectedKey, showTitles } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useZoom({
    scrollRef,
    contentRef: svgRef,
    keyRootRef: options.keyRootRef,
    magnification: options.magnification,
    onMagnificationChange: options.onMagnificationChange,
    reservedWidth: showTitles ? TITLE_LANE_WIDTH : 0,
  });
  const { cellSize } = zoom;
  const cells = useMemo(
    () => layoutCells(placeItems(items, scores, scopeMode), cellSize),
    [items, scores, scopeMode, cellSize],
  );
  const pulse = usePulse(selectedKey);
  useSelectionScroll(scrollRef, selectedKey, pulse.settle);
  const { drag, dragHandlersFor, selectItem, isHoldingPress } = useItemDrag({
    svgRef,
    cellSize,
    scores,
    scopeMode,
    selectedKey,
    onDrop: (key, cell) => {
      const levels = findCellLevels(cell.u, cell.v);
      if (levels) options.onScoresChange(key, levels);
    },
    onSelect: pulse.fromMatrix(options.onSelect),
  });
  usePan({ scrollRef, isHoldingPress });
  const titleLane = useTitleLane({
    scrollRef,
    svgRef,
    cells,
    cellSize,
    spareWidth: zoom.spareWidth,
    graph: options.graph,
    showTitles,
    showLines: options.showLines,
    selectedKey,
    hoveredKey: options.hoveredKey,
    onHighlight: options.onHighlight,
    onSelect: pulse.fromMatrix(options.onSelect),
  });
  return { scrollRef, svgRef, zoom, cells, pulse, drag, dragHandlersFor, selectItem, ...titleLane };
}
