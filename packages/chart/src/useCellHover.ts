import { type RefObject, useEffect, useEffectEvent, useState } from 'react';

import { toMatrixPoint } from './Grid.tsx';
import { findScoredCellAt } from './layout.ts';

/** How long, in milliseconds, the pointer rests in a cell before the cell's callouts show. */
export const CALLOUT_DWELL = 200;

export interface CellHoverOptions {
  /** The scroll container, whose pointer events the hook watches. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The chart's SVG, whose box maps the pointer to the matrix. */
  svgRef: RefObject<SVGSVGElement | null>;
  cellSize: number;
}

/** A scored cell, by its urgency column and value row. */
export interface HoveredCell {
  u: number;
  v: number;
}

/**
 * Returns the scored cell on whose empty spot a mouse or pen has rested for `CALLOUT_DWELL`: Each move restarts the wait
 * until the cell shows, and a later move within the cell keeps it. A circle, a gutter, a press, or the pointer's leaving
 * clears it at once.
 */
export function useCellHover({ scrollRef, svgRef, cellSize }: CellHoverOptions): HoveredCell | undefined {
  const [hovered, setHovered] = useState<HoveredCell>();
  const findCellAt = useEffectEvent((event: PointerEvent): HoveredCell | undefined => {
    if (event.target instanceof Element && event.target.closest('.tr-node')) return undefined;
    const point = toMatrixPoint(svgRef.current, event.clientX, event.clientY, cellSize);
    return point && findScoredCellAt(point.x, point.y, cellSize);
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
      if (event.pointerType === 'touch') return;
      const cell = event.buttons === 0 ? findCellAt(event) : undefined;
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

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', clear);
    container.addEventListener('pointerleave', clear);
    return () => {
      clearTimeout(timer);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', clear);
      container.removeEventListener('pointerleave', clear);
    };
  }, [scrollRef]);

  return hovered;
}
