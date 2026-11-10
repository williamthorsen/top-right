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
