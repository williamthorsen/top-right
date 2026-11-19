import { type RefObject, useEffect } from 'react';

import { scrollIntoChartView } from './chart-scroll.ts';

/** Scrolls the selected item's circle or gutter row into the chart's view each time the selection changes. */
export function useSelectionScroll(scrollRef: RefObject<HTMLElement | null>, selectedKey: string | undefined): void {
  useEffect(() => {
    const chart = scrollRef.current;
    if (selectedKey === undefined || !chart) return;
    const element = chart.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    if (element) scrollIntoChartView(element, chart, chooseScrollBehavior());
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
