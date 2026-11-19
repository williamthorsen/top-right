/**
 * Scrolls the element's gutter list, when it is in one, and then the chart's scroll container by the least movement
 * that brings the element into each one's view, honoring its scroll margin. It never scrolls the page: On a narrow
 * screen the page scrolls past the chart, and a selection made below the chart must stay in view.
 */
export function scrollIntoChartView(element: Element, chart: Element, behavior: ScrollBehavior): void {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  let box = {
    top: rect.top - (Number.parseFloat(style.scrollMarginTop) || 0),
    bottom: rect.bottom + (Number.parseFloat(style.scrollMarginBottom) || 0),
    left: rect.left - (Number.parseFloat(style.scrollMarginLeft) || 0),
    right: rect.right + (Number.parseFloat(style.scrollMarginRight) || 0),
  };
  const list = element.closest('.tr-gutter-list');
  if (list && chart.contains(list)) {
    const delta = scrollBoxIntoView(list, box, behavior);
    // The chart then brings the element in where the list's scroll leaves it.
    box = {
      top: box.top - delta.top,
      bottom: box.bottom - delta.top,
      left: box.left - delta.left,
      right: box.right - delta.left,
    };
  }
  scrollBoxIntoView(chart, box, behavior);
}

/**
 * Returns how far to scroll along one axis so that the span from `start` to `end` lies within the view, which is
 * zero when it already does; a span longer than the view aligns its start with the view's.
 */
export function findNearestScrollDelta(start: number, end: number, viewStart: number, viewEnd: number): number {
  if (start >= viewStart && end <= viewEnd) return 0;
  if (end - start > viewEnd - viewStart || start < viewStart) return start - viewStart;
  return end - viewEnd;
}

// region | Helpers

/** Returns the value bounded by `min` and `max`, where `min` wins when the two cross. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Scrolls the container so that the box, in viewport coordinates, lies within its scrollport as far as its scroll
 * range allows, and returns the delta that it scrolls by.
 */
function scrollBoxIntoView(
  container: Element,
  box: { top: number; bottom: number; left: number; right: number },
  behavior: ScrollBehavior,
): { top: number; left: number } {
  const rect = container.getBoundingClientRect();
  const viewTop = rect.top + container.clientTop;
  const viewLeft = rect.left + container.clientLeft;
  const top = clamp(
    findNearestScrollDelta(box.top, box.bottom, viewTop, viewTop + container.clientHeight),
    -container.scrollTop,
    container.scrollHeight - container.clientHeight - container.scrollTop,
  );
  const left = clamp(
    findNearestScrollDelta(box.left, box.right, viewLeft, viewLeft + container.clientWidth),
    -container.scrollLeft,
    container.scrollWidth - container.clientWidth - container.scrollLeft,
  );
  if (top !== 0 || left !== 0) container.scrollBy({ top, left, behavior });
  return { top, left };
}

// endregion | Helpers
