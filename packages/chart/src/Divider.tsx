import type { KeyboardEvent, PointerEvent, ReactElement, RefObject } from 'react';

/** The least height in pixels that the divider leaves to each pane. */
const PANE_FLOOR = 120;
const KEY_STEP = 5;

export interface DividerProps {
  /** The first pane's share of the container's height, as a percentage. */
  value: number;
  onChange: (value: number) => void;
  /** The element whose height the two panes and the divider share. */
  containerRef: RefObject<HTMLElement | null>;
  label: string;
}

/** A window splitter between two stacked panes, moved by a pointer drag or by the arrow, Home, and End keys. */
export function Divider({ value, onChange, containerRef, label }: DividerProps): ReactElement {
  function height(): number {
    return containerRef.current?.getBoundingClientRect().height ?? 0;
  }

  function moveTo(next: number): void {
    onChange(clampSplit(next, height()));
  }

  function moveOnKey(event: KeyboardEvent<HTMLDivElement>): void {
    const [low, high] = findSplitLimits(height());
    const targets: Partial<Record<string, number>> = {
      ArrowDown: value + KEY_STEP,
      ArrowUp: value - KEY_STEP,
      End: high,
      Home: low,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveTo(target);
  }

  function drag(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return;
    moveTo(((event.clientY - rect.top) / rect.height) * 100);
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focusable separator with a value is the ARIA window-splitter widget, which the plugin classes as static.
    <div
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value)}
      className="tr-divider"
      onKeyDown={moveOnKey}
      onPointerDown={startDrag}
      onPointerMove={drag}
      role="separator"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the window splitter takes focus, as above.
      tabIndex={0}
    />
  );
}

/** Returns the split clamped so that each pane keeps its floor, or an even split when the container cannot hold both floors. */
export function clampSplit(value: number, containerHeight: number): number {
  const [min, max] = findSplitLimits(containerHeight);
  return Math.min(max, Math.max(min, value));
}

// region | Helpers
/** Returns the least and the greatest split that leave each pane its floor in a container of the height. */
function findSplitLimits(containerHeight: number): [number, number] {
  if (containerHeight < 2 * PANE_FLOOR) return [50, 50];
  const min = (PANE_FLOOR / containerHeight) * 100;
  return [min, 100 - min];
}

/** Captures the pointer, so that the drag follows it outside the divider. */
function startDrag(event: PointerEvent<HTMLDivElement>): void {
  event.currentTarget.setPointerCapture(event.pointerId);
}
// endregion | Helpers
