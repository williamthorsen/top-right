import { useEffect, useRef, useState } from 'react';

/** The circle whose pulse is playing; `id` tells one pulse of a circle from the next. */
export interface CirclePulse {
  key: string;
  id: number;
}

/** The pulse that locates an item selected outside the matrix, and the means to play and end it. */
export interface Pulse {
  /** The circle whose copy the chart's overlay draws and animates, while one plays. */
  circle: CirclePulse | undefined;
  /** Wraps a select made in the matrix, whose item the reader is already looking at, so that it plays no pulse. */
  fromMatrix: (select: (key: string) => void) => (key: string) => void;
  /** Pulses the item whose circle or gutter row is `element` once its selection settles, unless the matrix made it. */
  settle: (key: string, element: Element) => void;
  /** Removes the circle's copy once its animation ends. */
  end: () => void;
}

/** How much larger a circle grows at the pulse's peak. */
const CIRCLE_PULSE_SCALE = 1.2;
/** How much larger a gutter row grows at the pulse's peak, which keeps it within its column. */
const ROW_PULSE_SCALE = 1.07;
const PULSE_TIMING: KeyframeAnimationOptions = { duration: 560, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' };

/**
 * Holds the pulse that grows a selected item once and settles it back, and ends a playing pulse when the selection
 * changes or the chart unmounts.
 */
export function usePulse(selectedKey: string | undefined): Pulse {
  const [circle, setCircle] = useState<CirclePulse>();
  const rowAnimation = useRef<Animation | undefined>(undefined);
  const nextId = useRef(0);
  const matrixSelection = useRef<string>(undefined);

  useEffect(
    () => () => {
      rowAnimation.current?.cancel();
      rowAnimation.current = undefined;
      setCircle(undefined);
    },
    [selectedKey],
  );

  function settle(key: string, element: Element): void {
    const isFromMatrix = matrixSelection.current === key;
    matrixSelection.current = undefined;
    if (isFromMatrix || !canAnimate(element)) return;
    if (element instanceof HTMLElement) {
      rowAnimation.current?.cancel();
      rowAnimation.current = element.animate(buildPulseKeyframes(ROW_PULSE_SCALE), PULSE_TIMING);
      return;
    }
    nextId.current += 1;
    setCircle({ key, id: nextId.current });
  }

  return {
    circle,
    fromMatrix: (select) => (key) => {
      // Reselecting the selected item changes nothing, so it leaves no note for a later selection to match.
      if (key !== selectedKey) matrixSelection.current = key;
      select(key);
    },
    settle,
    end: () => setCircle(undefined),
  };
}

/** Plays a circle's pulse on its copy, returning the animation, or nothing where the browser cannot animate. */
export function playCirclePulse(element: Element): Animation | undefined {
  if (typeof element.animate !== 'function') return undefined;
  return element.animate(buildPulseKeyframes(CIRCLE_PULSE_SCALE), PULSE_TIMING);
}

// region | Helpers

/** Returns keyframes that grow an element to `peak` and settle it back to its size. */
function buildPulseKeyframes(peak: number): Keyframe[] {
  return [{ transform: 'scale(1)' }, { transform: `scale(${peak})`, offset: 0.4 }, { transform: 'scale(1)' }];
}

/** Returns whether the browser can animate the element and the reader has not asked for reduced motion. */
function canAnimate(element: Element): boolean {
  if (typeof element.animate !== 'function') return false;
  return !(
    typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// endregion | Helpers
