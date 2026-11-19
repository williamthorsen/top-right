import { type RefObject, useEffect } from 'react';

/**
 * Scrolls the selected item's circle or gutter row into view each time the selection changes, which scrolls both the
 * gutter cell's list and the chart's scroll container, and leaves a mark that is already in view where it is.
 */
export function useSelectionScroll(scrollRef: RefObject<HTMLElement | null>, selectedKey: string | undefined): void {
  useEffect(() => {
    if (selectedKey === undefined) return;
    const element = scrollRef.current?.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    element?.scrollIntoView({ behavior: chooseScrollBehavior(), block: 'nearest', inline: 'nearest' });
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
