import { act, fireEvent, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import { describe, expect, it, onTestFinished } from 'vitest';

import { HEIGHT, WIDTH } from '../Grid.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { reportResize } from '../test-utils/resize-observer.ts';
import { WHEEL_STEP_THRESHOLD } from '../useZoom.ts';

const ITEMS = [buildItem({ number: 1 })];
const SCORES = { [`${REPO}#1`]: place(3, 3) };

describe('Chart zoom', () => {
  it('opens in Fit, at the natural size in an area without layout', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);

    expectScale(1);
    expectReadoutText('Fit');
    expect(getReadout()).toHaveAccessibleName('Zoom, Fit, 100\u{A0}%');
    await user.click(getReadout());
    expect(screen.getByRole('menuitemradio', { name: 'Fit' })).toBeChecked();
  });

  it('fits the matrix to the chart area that it opens in', () => {
    mockScrollAreaSize({ width: WIDTH * 1.4, height: HEIGHT * 2 });

    renderChart(ITEMS, {}, SCORES);

    expectScale(1.4);
  });

  it('refits the matrix while Fit is on when the chart area changes size', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    resize(scroll, { width: WIDTH * 1.4, height: HEIGHT * 2 });
    expectScale(1.4);
    resize(scroll, { width: WIDTH * 3, height: HEIGHT * 2.2 });
    expectScale(2.2);
  });

  it('keeps the natural size in a chart area too small for it', () => {
    renderChart(ITEMS, {}, SCORES);

    resize(getScroll(), { width: WIDTH / 2, height: HEIGHT / 2 });

    expectScale(1);
  });

  it.each([
    {
      input: 'a zoom button',
      zoomByHand: (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Zoom in' })),
    },
    { input: 'a menu step', zoomByHand: (user: UserEvent) => chooseFromMenu(user, '150\u{A0}%') },
    { input: 'the 0 key', zoomByHand: (user: UserEvent) => user.keyboard('0') },
    {
      input: 'the wheel',
      zoomByHand: () => {
        fireEvent.wheel(getScroll(), { ctrlKey: true, deltaY: -WHEEL_STEP_THRESHOLD });
        return Promise.resolve();
      },
    },
  ])('stops refitting after $input zooms by hand, and refits again once Fit is chosen', async ({ zoomByHand }) => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();
    resize(scroll, { width: WIDTH * 1.4, height: HEIGHT * 2 });

    await zoomByHand(user);
    const manualScale = readScale();
    resize(scroll, { width: WIDTH * 3, height: HEIGHT * 3 });
    expectScale(manualScale);

    await chooseFromMenu(user, 'Fit');
    expectScale(3);
    resize(scroll, { width: WIDTH * 2, height: HEIGHT * 2 });
    expectScale(2);
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

  it('steps a touch pinch once when iOS also reports it as gesture events', () => {
    renderChart(ITEMS, {}, SCORES);
    const scroll = getScroll();

    fireTouches(scroll, 'touchstart', 100);
    fireGesture(scroll, 'gesturestart', 1);
    fireTouches(scroll, 'touchmove', 130);
    fireGesture(scroll, 'gesturechange', 1.3);

    expectScale(1.25);
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
    expectReadoutText('125\u{A0}%');
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
    expectReadoutText('Fit');
    expect(getReadout()).toHaveAccessibleName('Zoom, Fit, 140\u{A0}%');
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
    const centredOffset = (750 - WIDTH) / 2;
    const scroll = mockLayout(getScroll(), { width: 750, height: 300, left: 0, top: 0 });

    await user.keyboard('+');

    expect(scroll.scrollLeft).toBeCloseTo((375 - centredOffset) * 1.25 - 375);
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
/** Opens the readout's menu and chooses the item named `name`. */
async function chooseFromMenu(user: UserEvent, name: string): Promise<void> {
  await user.click(getReadout());
  await user.click(screen.getByRole('menuitemradio', { name }));
}

/** Asserts the readout's visible text, which the menu caret follows. */
function expectReadoutText(text: string): void {
  expect(getReadout().firstChild?.textContent).toBe(text);
}

function expectScale(scale: number): void {
  const svg = screen.getByRole('group', { name: 'Items by urgency and value' });
  expect(svg).toHaveAttribute('width', String(WIDTH * scale));
  expect(svg).toHaveAttribute('height', String(HEIGHT * scale));
}

function getReadout(): HTMLElement {
  return screen.getByRole('button', { name: /^Zoom, / });
}

/**
 * Gives every chart scroll container a client size from the moment it mounts, which `mockLayout` cannot do because it
 * patches an element that already exists.
 */
function mockScrollAreaSize(size: { width: number; height: number }): void {
  const prototype = HTMLElement.prototype;
  // jsdom lays nothing out, so every other element keeps its client size of 0.
  Object.defineProperties(prototype, {
    clientWidth: {
      configurable: true,
      get(this: HTMLElement): number {
        return this.classList.contains('tr-chart-scroll') ? size.width : 0;
      },
    },
    clientHeight: {
      configurable: true,
      get(this: HTMLElement): number {
        return this.classList.contains('tr-chart-scroll') ? size.height : 0;
      },
    },
  });
  onTestFinished(() => {
    Reflect.deleteProperty(prototype, 'clientWidth');
    Reflect.deleteProperty(prototype, 'clientHeight');
  });
}

/** Returns the matrix's current scale, read from its rendered width. */
function readScale(): number {
  const svg = screen.getByRole('group', { name: 'Items by urgency and value' });
  return Number(svg.getAttribute('width')) / WIDTH;
}

/** Gives the scroll container a new client size and reports the resize to its observers. */
function resize(scroll: HTMLElement, size: { width: number; height: number }): void {
  mockLayout(scroll, { ...size, left: 0, top: 0 });
  act(() => reportResize(scroll));
}

function getScroll(): HTMLElement {
  const svg = screen.getByRole('group', { name: 'Items by urgency and value' });
  // eslint-disable-next-line testing-library/no-node-access -- the scroll container has no role to query.
  const scroll = svg.closest<HTMLElement>('.tr-chart-scroll');
  if (!scroll) throw new Error('The chart has no scroll container');
  return scroll;
}

/** Dispatches a WebKit gesture event, which jsdom does not define, and returns whether its default survived. */
function fireGesture(target: Element, type: string, scale: number): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { scale: { value: scale }, clientX: { value: 0 }, clientY: { value: 0 } });
  return fireEvent(target, event);
}

/** Dispatches a touch event whose two touches lie `distance` apart, as jsdom cannot construct real `Touch` objects. */
function fireTouches(target: Element, type: string, distance: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = { length: 2, 0: { clientX: 0, clientY: 0 }, 1: { clientX: distance, clientY: 0 } };
  Object.defineProperty(event, 'touches', { value: touches });
  fireEvent(target, event);
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
  const svg = screen.getByRole('group', { name: 'Items by urgency and value' });
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
