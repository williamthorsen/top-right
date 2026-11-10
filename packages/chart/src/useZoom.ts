import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import { DEFAULT_ZOOM, fitScale, isAtEnd, stepZoom, type Zoom, type ZoomDirection } from './zoom.ts';

export interface ZoomOptions {
  /** The scroll container whose content the zoom scales. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The scaled content, whose laid-out box locates the anchored point. */
  contentRef: RefObject<Element | null>;
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

/**
 * How far a Ctrl or Cmd wheel scrolls, in pixels, before it steps. A mouse-wheel notch passes it in one event, whatever
 * delta the platform reports, and a trackpad pinch's small deltas add up to it.
 */
export const WHEEL_STEP_THRESHOLD = 60;
/** How long a wheel gesture may pause, in milliseconds, before its accumulated scroll is dropped. */
const WHEEL_IDLE_MS = 200;
/** The pixels that one line of a line-mode wheel event stands for. */
const LINE_HEIGHT = 16;
/** The WebKit events that report a trackpad pinch. */
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'];
/** Targets in which the zoom keys keep their own meaning. */
const KEY_EXEMPT_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]';

/**
 * Holds the matrix's zoom and wires its inputs: Ctrl or Cmd with the wheel (which a trackpad pinch also sends) and a
 * two-finger touch pinch over the scroll container, and the `+`, `-`, and `0` keys. Each change keeps an anchor point in
 * place by correcting the container's scroll: the pointer for the wheel and the pinch, the visible centre otherwise.
 */
export function useZoom({ scrollRef, contentRef, keyRootRef }: ZoomOptions): ZoomState {
  const [zoom, setZoom] = useState<Zoom>(DEFAULT_ZOOM);
  // Several wheel or pinch events can arrive before a commit, so each steps from the latest request.
  const requestedScale = useRef(DEFAULT_ZOOM.scale);
  const anchor = useRef<Anchor>(undefined);

  /** Records a zoom change and the client point that it keeps in place, the visible centre by default. */
  function request(next: Zoom, at?: ClientPoint): void {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (container && content) anchor.current = locateAnchor(content, at ?? findVisibleCentre(container));
    requestedScale.current = next.scale;
    setZoom(next);
  }

  function step(direction: ZoomDirection, at?: ClientPoint): void {
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

  // Scroll the anchored point of the matrix back under the anchor once the new size is laid out, wherever the scroll
  // container's centring places the matrix before and after.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    const held = anchor.current;
    anchor.current = undefined;
    if (!container || !content || !held) return;
    const box = content.getBoundingClientRect();
    container.scrollLeft += box.left + held.fractionX * box.width - held.clientX;
    container.scrollTop += box.top + held.fractionY * box.height - held.clientY;
  }, [scrollRef, contentRef, zoom.scale]);

  const stepAt = useEffectEvent((direction: ZoomDirection, at: ClientPoint) => step(direction, at));
  const readScale = useEffectEvent(() => requestedScale.current);

  // React's wheel and touch handlers are passive, and only an active listener can keep the page from zooming.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let accumulated = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let pinchDistance: number | undefined;
    let gestureScale: number | undefined;

    function handleWheel(event: WheelEvent): void {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
      accumulated += event.deltaY * unit;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        accumulated = 0;
      }, WHEEL_IDLE_MS);
      if (Math.abs(accumulated) < WHEEL_STEP_THRESHOLD) return;
      // One event steps once at most, so that a notch is one step however large the platform's delta.
      const direction = accumulated < 0 ? 'in' : 'out';
      accumulated = 0;
      stepAt(direction, { clientX: event.clientX, clientY: event.clientY });
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
      stepAt(direction, { clientX: x, clientY: y });
    }

    function handleTouchEnd(event: TouchEvent): void {
      if (event.touches.length < 2) pinchDistance = undefined;
    }

    // Safari reports a trackpad pinch as gesture events, whose `scale` runs from 1 at the gesture's start.
    function handleGesture(event: Event): void {
      event.preventDefault();
      const gesture = readGesture(event);
      if (event.type === 'gesturestart') gestureScale = 1;
      else if (event.type === 'gestureend') gestureScale = undefined;
      if (event.type !== 'gesturechange' || !gesture || gestureScale === undefined) return;
      const direction = choosePinchDirection(gesture.scale / gestureScale, readScale());
      if (direction === undefined) return;
      gestureScale = gesture.scale;
      stepAt(direction, gesture);
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    for (const type of GESTURE_EVENTS) container.addEventListener(type, handleGesture);
    return () => {
      for (const type of GESTURE_EVENTS) container.removeEventListener(type, handleGesture);
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

/** A point in client coordinates. */
interface ClientPoint {
  clientX: number;
  clientY: number;
}

/** A client point and where it falls across the content's box, as a fraction of each dimension. */
interface Anchor extends ClientPoint {
  fractionX: number;
  fractionY: number;
}

// region | Helpers
/** Returns the direction in which a pinch has passed the next step from `scale`, if it has passed one. */
function choosePinchDirection(ratio: number, scale: number): ZoomDirection | undefined {
  if (ratio >= stepZoom(scale, 'in') / scale && !isAtEnd(scale, 'in')) return 'in';
  if (ratio <= stepZoom(scale, 'out') / scale && !isAtEnd(scale, 'out')) return 'out';
  return undefined;
}

/** Returns the visible centre of a scroll container's client area. */
function findVisibleCentre(container: Element): ClientPoint {
  const box = container.getBoundingClientRect();
  return {
    clientX: box.left + container.clientLeft + container.clientWidth / 2,
    clientY: box.top + container.clientTop + container.clientHeight / 2,
  };
}

/** Returns the anchor that holds `at` over the point of the content beneath it. */
function locateAnchor(content: Element, at: ClientPoint): Anchor {
  const box = content.getBoundingClientRect();
  return {
    ...at,
    fractionX: box.width === 0 ? 0 : (at.clientX - box.left) / box.width,
    fractionY: box.height === 0 ? 0 : (at.clientY - box.top) / box.height,
  };
}

/** Returns the scale and position of a WebKit gesture event, which the DOM typings do not describe. */
function readGesture(event: Event): (ClientPoint & { scale: number }) | undefined {
  if (!('scale' in event && 'clientX' in event && 'clientY' in event)) return undefined;
  const { scale, clientX, clientY } = event;
  if (typeof scale !== 'number' || typeof clientX !== 'number' || typeof clientY !== 'number') return undefined;
  return { scale, clientX, clientY };
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
