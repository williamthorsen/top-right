import type { ItemScores } from '@top-right/model';
import { type PointerEvent, type RefObject, useRef, useState } from 'react';

import { HEIGHT, MARGIN_LEFT, MARGIN_TOP, WIDTH } from './Grid.tsx';
import { findScoredCellAt, type ScopeMode, sizeItem } from './layout.ts';

/** A drag in progress: the dragged item, its circle's radius, the pointer in matrix units, and the drop target. */
export interface ItemDrag {
  key: string;
  r: number;
  x: number;
  y: number;
  /** The scored cell that a drop would move the item to; undefined over its own cell, a gutter, or off the matrix. */
  target: { u: number; i: number } | undefined;
}

/** The pointer handlers that make an element the handle of an item's drag, with the ref that keeps touch from scrolling. */
export interface DragHandlers {
  ref: (element: Element | null) => (() => void) | undefined;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
}

export interface ItemDragOptions {
  svgRef: RefObject<SVGSVGElement | null>;
  /** The scores that place each item in its cell and size its circle. */
  scores: Readonly<Record<string, ItemScores>>;
  scopeMode: ScopeMode;
  /** The selected item, the only one that drags. */
  selectedKey: string | undefined;
  /** Reports a drop on a scored cell other than the item's own. */
  onDrop: (key: string, cell: { u: number; i: number }) => void;
  onSelect: (key: string) => void;
}

export interface ItemDragState {
  drag: ItemDrag | undefined;
  /** Returns the drag handlers of the selected item, sized at `r` when given; any other item gets none. */
  dragHandlersFor: (key: string, r?: number) => DragHandlers | undefined;
  /** Selects an item, unless the click ends a drag of it. */
  selectItem: (key: string) => void;
}

/** How far, in CSS pixels, a pointer moves from where it was pressed before the press becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Drags an item to a scored cell: A press captures the pointer, a move past the threshold starts the drag, and a release
 * over a scored cell other than the item's own reports the drop. A cancelled pointer ends the drag without a drop.
 */
export function useItemDrag({
  svgRef,
  scores,
  scopeMode,
  selectedKey,
  onDrop,
  onSelect,
}: ItemDragOptions): ItemDragState {
  const [drag, setDrag] = useState<ItemDrag>();
  const press = useRef<{ key: string; r: number; pointerId: number; x: number; y: number; isDragging: boolean }>(
    undefined,
  );
  const justDragged = useRef(false);

  function dragHandlersFor(key: string, size?: number): DragHandlers | undefined {
    if (key !== selectedKey) return undefined;
    const r = size ?? sizeItem(scores[key], scopeMode).r;
    return {
      ref: holdTouch,
      onPointerDown(event) {
        justDragged.current = false;
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { key, r, pointerId: event.pointerId, x: event.clientX, y: event.clientY, isDragging: false };
      },
      onPointerMove(event) {
        const current = press.current;
        if (current?.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (!current.isDragging) {
          if (Math.hypot(event.clientX - current.x, event.clientY - current.y) <= DRAG_THRESHOLD) return;
          current.isDragging = true;
        }
        const point = toMatrixPoint(svgRef.current, event.clientX, event.clientY);
        if (!point) return;
        setDrag({ key, r: current.r, ...point, target: findTarget(point, cellOf(key)) });
      },
      onPointerUp(event) {
        const current = press.current;
        if (current?.pointerId !== event.pointerId) return;
        press.current = undefined;
        if (!current.isDragging) return;
        justDragged.current = true;
        // A drop that moves the item remounts its element, so the click that follows may never reach `selectItem`.
        setTimeout(() => {
          justDragged.current = false;
        }, 0);
        setDrag(undefined);
        const point = toMatrixPoint(svgRef.current, event.clientX, event.clientY);
        const target = point && findTarget(point, cellOf(key));
        if (target) onDrop(key, target);
      },
      onPointerCancel(event) {
        if (press.current?.pointerId !== event.pointerId) return;
        press.current = undefined;
        setDrag(undefined);
      },
    };
  }

  function selectItem(key: string): void {
    const wasDragged = justDragged.current;
    justDragged.current = false;
    if (!wasDragged) onSelect(key);
  }

  /** Returns the cell that the item occupies now, each axis 0 when unscored. */
  function cellOf(key: string): { u: number; i: number } {
    return { u: scores[key]?.urgency?.value ?? 0, i: scores[key]?.impact?.value ?? 0 };
  }

  return { drag, dragHandlersFor, selectItem };
}

// region | Helpers
/**
 * Keeps a touch on the element from scrolling the chart, so that the browser does not cancel the pointer. `touch-action`
 * does not reach an SVG shape, so the handle cancels the touch's moves instead, which leaves a tap a click.
 */
function holdTouch(element: Element | null): (() => void) | undefined {
  if (!element) return undefined;
  element.addEventListener('touchmove', preventDefault, { passive: false });
  return () => element.removeEventListener('touchmove', preventDefault);
}

/** Returns the scored cell under `point`, unless it is the item's own cell. */
function findTarget(
  point: { x: number; y: number },
  own: { u: number; i: number },
): { u: number; i: number } | undefined {
  const cell = findScoredCellAt(point.x, point.y);
  return cell && (cell.u !== own.u || cell.i !== own.i) ? cell : undefined;
}

function preventDefault(event: Event): void {
  event.preventDefault();
}

/** Converts a pointer's client position to matrix units, whose origin is the top-left of the impact-5 row. */
function toMatrixPoint(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } | undefined {
  const rect = svg?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return undefined;
  return {
    x: ((clientX - rect.left) * WIDTH) / rect.width - MARGIN_LEFT,
    y: ((clientY - rect.top) * HEIGHT) / rect.height - MARGIN_TOP,
  };
}
// endregion | Helpers
