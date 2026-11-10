import { type RefObject, useEffect, useEffectEvent } from 'react';

import { DRAG_THRESHOLD } from './useItemDrag.ts';

export interface PanOptions {
  /** The scroll container that the pan scrolls. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Returns whether the selected item's drag holds the pointer's press, which then rescores rather than pans. */
  isHoldingPress: () => boolean;
}

/**
 * Pans the scroll container by a mouse or pen drag while its content is larger than it: The pan starts once the pointer
 * passes the drag threshold, so that a shorter press stays a click, and the click that ends a pan is swallowed. Touch
 * keeps the browser's own scrolling. The container's `data-pannable` and `data-panning` attributes set its cursor.
 */
export function usePan({ scrollRef, isHoldingPress }: PanOptions): void {
  const readIsHoldingPress = useEffectEvent(isHoldingPress);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let press: { pointerId: number; x: number; y: number; left: number; top: number; isPanning: boolean } | undefined;
    let isSwallowingClick = false;

    function handlePointerDown(event: PointerEvent): void {
      if (!container || (event.pointerType !== 'mouse' && event.pointerType !== 'pen') || event.button !== 0) return;
      if (!isPannable(container) || isOnScrollbar(event)) return;
      press = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: container.scrollLeft,
        top: container.scrollTop,
        isPanning: false,
      };
    }

    function handlePointerMove(event: PointerEvent): void {
      if (!container) return;
      if (press?.pointerId !== event.pointerId) {
        if (press === undefined) container.dataset['pannable'] = String(isPannable(container));
        return;
      }
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (!press.isPanning) {
        if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
        // React's handlers run after this listener, so the drag's claim on the press is known only by the first move.
        if (readIsHoldingPress()) {
          press = undefined;
          return;
        }
        press.isPanning = true;
        container.setPointerCapture(event.pointerId);
        container.dataset['panning'] = 'true';
      }
      container.scrollLeft = press.left - dx;
      container.scrollTop = press.top - dy;
    }

    function handlePointerEnd(event: PointerEvent): void {
      if (!container || press?.pointerId !== event.pointerId) return;
      if (press.isPanning) {
        isSwallowingClick = true;
        // A pan that ends off the content leaves no click to swallow.
        setTimeout(() => {
          isSwallowingClick = false;
        }, 0);
        delete container.dataset['panning'];
      }
      press = undefined;
    }

    function swallowClick(event: MouseEvent): void {
      if (!isSwallowingClick) return;
      isSwallowingClick = false;
      event.stopPropagation();
      event.preventDefault();
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerEnd);
    container.addEventListener('pointercancel', handlePointerEnd);
    container.addEventListener('click', swallowClick, { capture: true });
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerEnd);
      container.removeEventListener('pointercancel', handlePointerEnd);
      container.removeEventListener('click', swallowClick, { capture: true });
    };
  }, [scrollRef]);
}

// region | Helpers
/** Returns whether a press landed on the scrollbar of the element that it targets, such as a long gutter list's. */
function isOnScrollbar(event: PointerEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const scrollsX = target.scrollWidth > target.clientWidth;
  const scrollsY = target.scrollHeight > target.clientHeight;
  return (scrollsY && event.offsetX >= target.clientWidth) || (scrollsX && event.offsetY >= target.clientHeight);
}

function isPannable(container: HTMLElement): boolean {
  return container.scrollWidth > container.clientWidth || container.scrollHeight > container.clientHeight;
}
// endregion | Helpers
