import { type RefObject, useEffect, useEffectEvent } from 'react';

import { scrollIntoChartView } from './chart-scroll.ts';

/** How long a smooth scroll may run before the selection counts as settled, for a browser that fires no `scrollend`. */
const SETTLE_TIMEOUT = 1000;

/**
 * Scrolls the selected item's circle or gutter row into the chart's view each time the selection changes, then calls
 * `onSettled` with the item's element once every container that it scrolled has stopped.
 */
export function useSelectionScroll(
  scrollRef: RefObject<HTMLElement | null>,
  selectedKey: string | undefined,
  onSettled: (key: string, element: Element) => void,
): void {
  const settle = useEffectEvent(onSettled);

  useEffect(() => {
    const chart = scrollRef.current;
    if (selectedKey === undefined || !chart) return;
    const element = chart.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    if (!element) return;
    const behavior = chooseScrollBehavior();
    const scrolled = scrollIntoChartView(element, chart, behavior);
    if (behavior !== 'smooth' || scrolled.length === 0) {
      settle(selectedKey, element);
      return;
    }

    const pending = new Set(scrolled);
    function stopWaiting(): void {
      clearTimeout(timeout);
      for (const container of scrolled) container.removeEventListener('scrollend', endScroll);
    }
    function finish(): void {
      stopWaiting();
      if (selectedKey !== undefined && element) settle(selectedKey, element);
    }
    function endScroll(event: Event): void {
      if (event.currentTarget instanceof Element) pending.delete(event.currentTarget);
      if (pending.size === 0) finish();
    }
    const timeout = setTimeout(finish, SETTLE_TIMEOUT);
    for (const container of scrolled) container.addEventListener('scrollend', endScroll);
    return stopWaiting;
  }, [selectedKey]);
}

// region | Helpers

/** Returns an instant scroll when the reader prefers reduced motion, and a smooth one otherwise. */
function chooseScrollBehavior(): ScrollBehavior {
  const isReduced =
    typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 'instant' : 'smooth';
}

// endregion | Helpers
