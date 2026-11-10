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

  it('steps with a Ctrl or Cmd wheel and keeps the page from zooming, one step per threshold', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    expect(fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD })).toBe(false);
    expectScale(1.25);
    fireEvent.wheel(scroll, { metaKey: true, deltaY: WHEEL_STEP_THRESHOLD * 2 });
    expectScale(0.75);
    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD / 2 });
    expectScale(0.75);
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
    mockScrollGeometry(getScroll(), { width: WIDTH * 1.4, height: HEIGHT * 2, left: 0, top: 0 });

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
    const scroll = mockScrollGeometry(getScroll(), { width: 400, height: 300, left: 100, top: 50 });

    await user.keyboard('+');

    expect(scroll.scrollLeft).toBe((100 + 200) * 1.25 - 200);
    expect(scroll.scrollTop).toBe((50 + 150) * 1.25 - 150);
  });

  it('keeps the point under the pointer in place when the wheel steps', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = mockScrollGeometry(getScroll(), { width: 400, height: 300, left: 100, top: 50 });
    scroll.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 20, width: 400, height: 300 });

    fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD, clientX: 110, clientY: 120 });

    expect(scroll.scrollLeft).toBe((100 + 100) * 1.25 - 100);
    expect(scroll.scrollTop).toBe((50 + 100) * 1.25 - 100);
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

/** Gives the scroll container a client size and a settable scroll position, which jsdom does not lay out. */
function mockScrollGeometry(
  element: HTMLElement,
  geometry: { width: number; height: number; left: number; top: number },
): HTMLElement {
  return Object.defineProperties(element, {
    clientWidth: { configurable: true, value: geometry.width },
    clientHeight: { configurable: true, value: geometry.height },
    scrollLeft: { configurable: true, writable: true, value: geometry.left },
    scrollTop: { configurable: true, writable: true, value: geometry.top },
  });
}
// endregion | Helpers
