import { type RefObject, useEffect, useEffectEvent, useState } from 'react';

import { toMatrixPoint } from './Grid.tsx';
import { findCellAt } from './layout.ts';

/** How long, in milliseconds, the pointer rests in a cell before the cell's callouts show. */
export const CALLOUT_DWELL = 200;

export interface CellHoverOptions {
  /** The scroll container, whose pointer events the hook watches. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The chart's SVG, whose box maps the pointer to the matrix. */
  svgRef: RefObject<SVGSVGElement | null>;
  cellSize: number;
}

/** A matrix cell, by its urgency column and value row, either of which is 0 in a gutter. */
export interface HoveredCell {
  u: number;
  v: number;
}

/**
 * Returns the cell on which a mouse or pen has rested for `CALLOUT_DWELL`, on an empty spot of a scored cell or
 * anywhere in a gutter cell, its rows included: Each move restarts the wait until the cell shows, and a later move
 * within the cell keeps it, as does a move or a press over the titles lane. A circle, a ghost, a press, or the
 * pointer's leaving clears it at once.
 */
export function useCellHover({ scrollRef, svgRef, cellSize }: CellHoverOptions): HoveredCell | undefined {
  const [hovered, setHovered] = useState<HoveredCell>();
  const findHoveredCell = useEffectEvent((event: PointerEvent): HoveredCell | undefined => {
    if (event.target instanceof Element && event.target.closest('.tr-node')) return undefined;
    const point = toMatrixPoint(svgRef.current, event.clientX, event.clientY, cellSize);
    return point && findCellAt(point.x, point.y, cellSize);
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let pending: HoveredCell | undefined;
    let isShown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clear(): void {
      clearTimeout(timer);
      pending = undefined;
      isShown = false;
      setHovered(undefined);
    }

    function handlePointerMove(event: PointerEvent): void {
      if (event.pointerType === 'touch' || isOverTitleLane(event)) return;
      const cell = event.buttons === 0 ? findHoveredCell(event) : undefined;
      if (cell?.u !== pending?.u || cell?.v !== pending?.v) clear();
      else if (isShown) return;
      pending = cell;
      clearTimeout(timer);
      if (cell) {
        timer = setTimeout(() => {
          isShown = true;
          setHovered(cell);
        }, CALLOUT_DWELL);
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!isOverTitleLane(event)) clear();
    }

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerleave', clear);
    return () => {
      clearTimeout(timer);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerleave', clear);
    };
  }, [scrollRef]);

  return hovered;
}

// region | Helpers
/** Returns whether a pointer event is over the titles lane, which keeps the cell to which the lane narrows. */
function isOverTitleLane(event: PointerEvent): boolean {
  return event.target instanceof Element && event.target.closest('.tr-title-lane') !== null;
}
// endregion | Helpers
