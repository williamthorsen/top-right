import { describe, expect, it, vi } from 'vitest';

import { findNearestScrollDelta, scrollIntoChartView, scrollIntoContainerView } from '../chart-scroll.ts';

describe(scrollIntoChartView, () => {
  // A 100 × 100 list of 24px rows below 10px of padding, scaled by the zoom, in a chart that does not scroll.
  it.each([1, 2, 0.5])(
    'scrolls a list scaled by %d by layout pixels, so that row 15 ends clear of its margin',
    (scale) => {
      const { chart, list, row } = buildChart(scale, { rowIndex: 15, scrollMargin: 24 });

      const scrolled = scrollIntoChartView(row, chart, 'instant');

      expect(scrolled).toStrictEqual([list]);
      // The row ends at 10 + 16 × 24 = 394 in the list, and its margin at 418, which a scroll of 318 brings to the
      // list's bottom.
      expect(list.scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 318, left: 0, behavior: 'instant' });
      expect(chart.scrollBy).not.toHaveBeenCalled();
    },
  );

  it('leaves a row that is already in view where it is', () => {
    const { chart, list, row } = buildChart(2, { rowIndex: 1, scrollMargin: 24 });

    const scrolled = scrollIntoChartView(row, chart, 'smooth');

    expect(scrolled).toStrictEqual([]);
    expect(list.scrollBy).not.toHaveBeenCalled();
    expect(chart.scrollBy).not.toHaveBeenCalled();
  });
});

describe(scrollIntoContainerView, () => {
  it('scrolls the container alone, so that row 15 ends clear of its margin', () => {
    const { chart, list, row } = buildChart(1, { rowIndex: 15, scrollMargin: 24 });

    scrollIntoContainerView(row, list, 'instant');

    expect(list.scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 318, left: 0, behavior: 'instant' });
    expect(chart.scrollBy).not.toHaveBeenCalled();
  });

  it('leaves a row that is already in view where it is', () => {
    const { list, row } = buildChart(1, { rowIndex: 1, scrollMargin: 24 });

    scrollIntoContainerView(row, list, 'instant');

    expect(list.scrollBy).not.toHaveBeenCalled();
  });
});

describe(findNearestScrollDelta, () => {
  it('returns zero for a span already within the view, at its edges included', () => {
    expect(findNearestScrollDelta(10, 30, 0, 100)).toBe(0);
    expect(findNearestScrollDelta(0, 100, 0, 100)).toBe(0);
  });

  it('brings a span below the view up to its bottom edge', () => {
    expect(findNearestScrollDelta(150, 174, 0, 100)).toBe(74);
  });

  it('brings a span above the view down to its top edge', () => {
    expect(findNearestScrollDelta(-50, -26, 0, 100)).toBe(-50);
  });

  it('aligns the start of a span longer than the view with the view', () => {
    expect(findNearestScrollDelta(150, 300, 0, 100)).toBe(150);
    expect(findNearestScrollDelta(-50, 120, 0, 100)).toBe(-50);
  });
});

// region | Helpers
interface Geometry {
  rect: { top: number; left: number; width: number; height: number };
  offset?: { width: number; height: number };
  client?: { width: number; height: number };
  scroll?: { width: number; height: number };
}

/**
 * Builds a chart holding one gutter list of 24px rows whose layout box is 100 × 100, drawn at `scale`, and returns the
 * row at `rowIndex`; jsdom lays nothing out, so each element reports the geometry that a browser would.
 */
function buildChart(
  scale: number,
  { rowIndex, scrollMargin }: { rowIndex: number; scrollMargin: number },
): { chart: HTMLElement; list: HTMLElement; row: HTMLElement } {
  const chart = document.createElement('div');
  const list = document.createElement('ul');
  list.className = 'tr-gutter-list';
  const row = document.createElement('button');
  row.style.scrollMarginBlock = `${scrollMargin}px`;
  list.append(row);
  chart.append(list);
  document.body.append(chart);

  stubGeometry(chart, {
    rect: { top: 0, left: 0, width: 400, height: 400 },
    offset: { width: 400, height: 400 },
    client: { width: 400, height: 400 },
    scroll: { width: 400, height: 400 },
  });
  stubGeometry(list, {
    rect: { top: 0, left: 0, width: 100 * scale, height: 100 * scale },
    offset: { width: 100, height: 100 },
    client: { width: 100, height: 100 },
    scroll: { width: 100, height: 600 },
  });
  const rowTop = 10 + rowIndex * 24;
  stubGeometry(row, {
    rect: { top: rowTop * scale, left: 10 * scale, width: 80 * scale, height: 24 * scale },
    offset: { width: 80, height: 24 },
  });
  return { chart, list, row };
}

/** Makes the element report the geometry and record its calls to `scrollBy`. */
function stubGeometry(element: HTMLElement, { rect, offset, client, scroll }: Geometry): void {
  const { top, left, width, height } = rect;
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  const values = {
    offsetWidth: offset?.width ?? 0,
    offsetHeight: offset?.height ?? 0,
    clientWidth: client?.width ?? 0,
    clientHeight: client?.height ?? 0,
    scrollWidth: scroll?.width ?? 0,
    scrollHeight: scroll?.height ?? 0,
  };
  for (const [name, value] of Object.entries(values)) Object.defineProperty(element, name, { value });
  Object.defineProperty(element, 'scrollBy', { value: vi.fn() });
}
// endregion | Helpers
