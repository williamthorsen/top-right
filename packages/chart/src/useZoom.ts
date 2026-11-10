import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import { DEFAULT_ZOOM, fitScale, isAtEnd, stepZoom, type Zoom, type ZoomDirection } from './zoom.ts';

export interface ZoomOptions {
  /** The scroll container whose content the zoom scales. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The element within which focus makes the zoom keys work; they also work while nothing on the page has focus. */
  keyRootRef: RefObject<HTMLElement | null>;
}

/** What a zoom input can choose: Fit, or a scale. */
export type ZoomChoice = 'fit' | number;

export interface ZoomState {
  zoom: Zoom;
  /** Steps the scale, keeping the centre of the visible area in place. */
  step: (direction: ZoomDirection) => void;
  /** Chooses Fit or a scale, keeping the centre of the visible area in place. */
  choose: (choice: ZoomChoice) => void;
}

/** How far a Ctrl or Cmd wheel scrolls, in pixels, per step; one mouse-wheel notch is about 100. */
export const WHEEL_STEP_THRESHOLD = 60;
/** How long a wheel gesture may pause, in milliseconds, before its accumulated scroll is dropped. */
const WHEEL_IDLE_MS = 200;
/** The pixels that one line of a line-mode wheel event stands for. */
const LINE_HEIGHT = 16;
/** Targets in which the zoom keys keep their own meaning. */
const KEY_EXEMPT_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]';

/**
 * Holds the matrix's zoom and wires its inputs: Ctrl or Cmd with the wheel (which a trackpad pinch also sends) and a
 * two-finger touch pinch over the scroll container, and the `+`, `-`, and `0` keys. Each change keeps an anchor point in
 * place by correcting the container's scroll: the pointer for the wheel and the pinch, the visible centre otherwise.
 */
export function useZoom({ scrollRef, keyRootRef }: ZoomOptions): ZoomState {
  const [zoom, setZoom] = useState<Zoom>(DEFAULT_ZOOM);
  // Several wheel or pinch events can arrive before a commit, so each steps from the latest request.
  const requestedScale = useRef(DEFAULT_ZOOM.scale);
  const committedScale = useRef(DEFAULT_ZOOM.scale);
  const anchor = useRef<{ x: number; y: number }>(undefined);

  /** Records a zoom change and the container-local point that it keeps in place, the visible centre by default. */
  function request(next: Zoom, at?: { x: number; y: number }): void {
    const container = scrollRef.current;
    anchor.current = at ?? (container ? { x: container.clientWidth / 2, y: container.clientHeight / 2 } : undefined);
    requestedScale.current = next.scale;
    setZoom(next);
  }

  function step(direction: ZoomDirection, at?: { x: number; y: number }): void {
    const scale = stepZoom(requestedScale.current, direction);
    if (scale !== requestedScale.current) request({ kind: 'step', scale }, at);
  }

  function choose(choice: ZoomChoice): void {
    if (choice !== 'fit') {
      request({ kind: 'step', scale: choice });
      return;
    }
    const container = scrollRef.current;
    request({ kind: 'fit', scale: fitScale(container?.clientWidth ?? 0, container?.clientHeight ?? 0) });
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    // A click on the chart's background leaves focus on the body, so the keys follow the body too.
    if (target !== document.body && !keyRootRef.current?.contains(target)) return;
    if (target.closest(KEY_EXEMPT_SELECTOR)) return;
    switch (event.key) {
      case '+':
      case '=':
        step('in');
        break;
      case '-':
        step('out');
        break;
      case '0':
        request({ kind: 'step', scale: DEFAULT_ZOOM.scale });
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keep the anchored point of the matrix under the anchor once the new size is laid out.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const old = committedScale.current;
    committedScale.current = zoom.scale;
    const at = anchor.current;
    if (!container || !at || old === zoom.scale) return;
    const ratio = zoom.scale / old;
    container.scrollLeft = (container.scrollLeft + at.x) * ratio - at.x;
    container.scrollTop = (container.scrollTop + at.y) * ratio - at.y;
  }, [scrollRef, zoom.scale]);

  const stepAt = useEffectEvent((direction: ZoomDirection, at: { x: number; y: number }) => step(direction, at));
  const readScale = useEffectEvent(() => requestedScale.current);

  // React's wheel and touch handlers are passive, and only an active listener can keep the page from zooming.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let accumulated = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let pinchDistance: number | undefined;

    function toLocal(clientX: number, clientY: number): { x: number; y: number } {
      const rect = container?.getBoundingClientRect();
      return {
        x: clientX - (rect?.left ?? 0) - (container?.clientLeft ?? 0),
        y: clientY - (rect?.top ?? 0) - (container?.clientTop ?? 0),
      };
    }

    function handleWheel(event: WheelEvent): void {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
      accumulated += event.deltaY * unit;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        accumulated = 0;
      }, WHEEL_IDLE_MS);
      while (Math.abs(accumulated) >= WHEEL_STEP_THRESHOLD) {
        const direction = accumulated < 0 ? 'in' : 'out';
        accumulated -= Math.sign(accumulated) * WHEEL_STEP_THRESHOLD;
        stepAt(direction, toLocal(event.clientX, event.clientY));
      }
    }

    function handleTouchStart(event: TouchEvent): void {
      const distance = event.touches.length === 2 ? measurePinch(event.touches).distance : 0;
      pinchDistance = distance > 0 ? distance : undefined;
    }

    function handleTouchMove(event: TouchEvent): void {
      if (event.touches.length !== 2 || pinchDistance === undefined) return;
      event.preventDefault();
      const { distance, x, y } = measurePinch(event.touches);
      const direction = choosePinchDirection(distance / pinchDistance, readScale());
      if (direction === undefined) return;
      pinchDistance = distance;
      stepAt(direction, toLocal(x, y));
    }

    function handleTouchEnd(event: TouchEvent): void {
      if (event.touches.length < 2) pinchDistance = undefined;
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      clearTimeout(idleTimer);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [scrollRef]);

  return { zoom, step: (direction) => step(direction), choose };
}

// region | Helpers
/** Returns the direction in which a pinch has passed the next step from `scale`, if it has passed one. */
function choosePinchDirection(ratio: number, scale: number): ZoomDirection | undefined {
  if (ratio >= stepZoom(scale, 'in') / scale && !isAtEnd(scale, 'in')) return 'in';
  if (ratio <= stepZoom(scale, 'out') / scale && !isAtEnd(scale, 'out')) return 'out';
  return undefined;
}

/** Returns the distance between a pinch's first two touches and their midpoint, in client coordinates. */
function measurePinch(touches: TouchList): { distance: number; x: number; y: number } {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return { distance: 0, x: 0, y: 0 };
  return {
    distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}
// endregion | Helpers
