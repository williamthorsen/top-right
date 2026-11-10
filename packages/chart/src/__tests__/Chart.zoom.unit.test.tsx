import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, onTestFinished } from 'vitest';

import { HEIGHT, WIDTH } from '../Grid.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { WHEEL_STEP_THRESHOLD } from '../useZoom.ts';

const ITEMS = [buildItem({ number: 1 })];
const SCORES = { [`${REPO}#1`]: place(3, 3) };

describe('Chart zoom', () => {
  it('opens at the natural size', () => {
    renderChart(ITEMS, {}, SCORES);

    expectScale(1);
  });

  it('steps in and out with the + and - keys, and returns to the natural size with 0', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);

    await user.keyboard('+');
    expectScale(1.25);
    await user.keyboard('=');
    expectScale(1.5);
    await user.keyboard('-');
    expectScale(1.25);
    await user.keyboard('0');
    expectScale(1);
  });

  it('ignores the zoom keys with a modifier held', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);

    await user.keyboard('{Control>}={/Control}{Meta>}-{/Meta}');

    expectScale(1);
  });

  it('ignores the zoom keys in a slider and outside the chart', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    const outside = document.createElement('input');
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    outside.focus();
    await user.keyboard('+');
    expectScale(1);

    await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
    screen.getByRole('slider').focus();
    await user.keyboard('+');
    expectScale(1);
  });

  it('steps with a Safari trackpad pinch and keeps the page from zooming', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    expect(fireGesture(scroll, 'gesturestart', 1)).toBe(false);
    fireGesture(scroll, 'gesturechange', 1.1);
    expectScale(1);
    expect(fireGesture(scroll, 'gesturechange', 1.3)).toBe(false);
    expectScale(1.25);
    fireGesture(scroll, 'gesturechange', 0.9);
    expectScale(1);
    fireGesture(scroll, 'gestureend', 0.9);
  });

  it('steps once per Ctrl or Cmd wheel event past the threshold, and keeps the page from zooming', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    expect(fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD })).toBe(false);
    expectScale(1.25);
    fireEvent.wheel(scroll, { metaKey: true, deltaY: WHEEL_STEP_THRESHOLD * 4 });
    expectScale(1);
  });

  it('adds up small wheel deltas, as a trackpad pinch sends them, until they pass the threshold', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD / 2 });
    expectScale(1);
    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD / 2 });
    expectScale(1.25);
  });

  it('leaves a plain wheel to scroll the chart', () => {
    renderChart(ITEMS, {}, SCORES);

    expect(fireEvent.wheel(getScroll(), { deltaY: -WHEEL_STEP_THRESHOLD * 4 })).toBe(true);
    expectScale(1);
  });

  it('steps with the zoom buttons, shows the scale in the readout, and disables each button at its end', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

    await user.click(zoomIn);
    expectScale(1.25);
    expect(getReadout()).toHaveAccessibleName('Zoom, 125\u{A0}%');
    for (const _ of [1.5, 2, 3, 4]) await user.click(zoomIn);
    expectScale(4);
    expect(zoomIn).toBeDisabled();
    for (const _ of [3, 2, 1.5, 1.25, 1, 0.75, 0.5]) await user.click(zoomOut);
    expectScale(0.5);
    expect(zoomOut).toBeDisabled();
    expect(zoomIn).toBeEnabled();
  });

  it('sets the scale that a readout menu item names, and marks it checked', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);

    await user.click(getReadout());
    await user.click(screen.getByRole('menuitemradio', { name: '200\u{A0}%' }));
    expectScale(2);

    await user.click(getReadout());
    expect(screen.getByRole('menuitemradio', { name: '200\u{A0}%' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: '100\u{A0}%' })).not.toBeChecked();
  });

  it('fits the matrix to the chart area, keeps Fit checked, and steps from the Fit scale to the adjacent step', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    mockLayout(getScroll(), { width: WIDTH * 1.4, height: HEIGHT * 2, left: 0, top: 0 });

    await user.click(getReadout());
    await user.click(screen.getByRole('menuitemradio', { name: 'Fit' }));
    expectScale(1.4);
    expect(getReadout()).toHaveAccessibleName('Zoom, 140\u{A0}%');
    await user.click(getReadout());
    expect(screen.getByRole('menuitemradio', { name: 'Fit' })).toBeChecked();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expectScale(1.5);
  });

  it('keeps the centre of the visible area in place when a key steps', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    const scroll = mockLayout(getScroll(), { width: 400, height: 300, left: 100, top: 50 });

    await user.keyboard('+');

    expect(scroll.scrollLeft).toBeCloseTo((100 + 200) * 1.25 - 200);
    expect(scroll.scrollTop).toBeCloseTo((50 + 150) * 1.25 - 150);
  });

  it('keeps the visible centre in place when a step takes a centred matrix past the chart area', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    const centredOffset = (900 - WIDTH) / 2;
    const scroll = mockLayout(getScroll(), { width: 900, height: 300, left: 0, top: 0 });

    await user.keyboard('+');

    expect(scroll.scrollLeft).toBeCloseTo((450 - centredOffset) * 1.25 - 450);
    expect(scroll.scrollTop).toBeCloseTo(150 * 1.25 - 150);
  });

  it('keeps the point under the pointer in place when the wheel steps', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = mockLayout(getScroll(), { width: 400, height: 300, left: 100, top: 50, x: 10, y: 20 });

    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD, clientX: 110, clientY: 120 });

    expect(scroll.scrollLeft).toBeCloseTo((100 + 100) * 1.25 - 100);
    expect(scroll.scrollTop).toBeCloseTo((50 + 100) * 1.25 - 100);
  });
});

// region | Helpers
function expectScale(scale: number): void {
  const svg = screen.getByRole('group', { name: 'Items by urgency and impact' });
  expect(svg).toHaveAttribute('width', String(WIDTH * scale));
  expect(svg).toHaveAttribute('height', String(HEIGHT * scale));
}

function getReadout(): HTMLElement {
  return screen.getByRole('button', { name: /^Zoom, / });
}

function getScroll(): HTMLElement {
  const svg = screen.getByRole('group', { name: 'Items by urgency and impact' });
  // eslint-disable-next-line testing-library/no-node-access -- the scroll container has no role to query.
  const scroll = svg.parentElement;
  if (!scroll) throw new Error('The chart has no scroll container');
  return scroll;
}

/** Dispatches a WebKit gesture event, which jsdom does not define, and returns whether its default survived. */
function fireGesture(target: Element, type: string, scale: number): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { scale: { value: scale }, clientX: { value: 0 }, clientY: { value: 0 } });
  return fireEvent(target, event);
}

/**
 * Lays out the scroll container and the matrix as the browser would, which jsdom does not: the container at `x`, `y`
 * with a client size and a settable scroll position, and the matrix centred in it while smaller, at its scaled size.
 */
function mockLayout(
  element: HTMLElement,
  layout: { width: number; height: number; left: number; top: number; x?: number; y?: number },
): HTMLElement {
  const x = layout.x ?? 0;
  const y = layout.y ?? 0;
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: layout.width },
    clientHeight: { configurable: true, value: layout.height },
    scrollLeft: { configurable: true, writable: true, value: layout.left },
    scrollTop: { configurable: true, writable: true, value: layout.top },
  });
  element.getBoundingClientRect = () => DOMRect.fromRect({ x, y, width: layout.width, height: layout.height });
  const svg = screen.getByRole('group', { name: 'Items by urgency and impact' });
  svg.getBoundingClientRect = () => {
    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));
    return DOMRect.fromRect({
      x: x - element.scrollLeft + Math.max(0, (layout.width - width) / 2),
      y: y - element.scrollTop + Math.max(0, (layout.height - height) / 2),
      width,
      height,
    });
  };
  return element;
}
// endregion | Helpers
