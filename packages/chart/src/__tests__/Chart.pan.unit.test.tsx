import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { applyScoreWrite, type ItemScores, type Scores, type WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP, measureFrame } from '../Grid.tsx';
import { GRID_SIZE, MIN_CELL_SIZE } from '../layout.ts';
import { buildItem, place, REPO } from '../test-utils/chart-fixtures.tsx';

/** The chart's size in chart units at the smallest cell. */
const FRAME = measureFrame(MIN_CELL_SIZE);

const FIRST = `${REPO}#1`;
const ITEMS = [buildItem({ number: 1 }), buildItem({ number: 2 })];
const SCORES = { [FIRST]: place(2, 2), [`${REPO}#2`]: place(4, 4) };
/** A container smaller than the matrix, scrolled away from its origin. */
const OVERFLOWING = { width: 400, height: 300, left: 100, top: 50 };
const MOUSE = { pointerId: 1, pointerType: 'mouse', button: 0 };

describe('Chart pan', () => {
  it('pans a matrix that is larger than the chart area by a drag on the background', () => {
    renderPanHost();
    const scroll = mockScrollGeometry(getScroll(), OVERFLOWING);

    dragBy(getSvg(), { dx: -50, dy: -30 });

    expect(scroll.scrollLeft).toBe(150);
    expect(scroll.scrollTop).toBe(80);
  });

  it('pans by a drag on an unselected circle, and swallows the click that ends the pan', () => {
    const { onSelectedKeyChange } = renderPanHost();
    const scroll = mockScrollGeometry(getScroll(), OVERFLOWING);
    const circle = getCircle(2);

    dragBy(circle, { dx: 40, dy: 0 });
    fireEvent.click(circle);

    expect(scroll.scrollLeft).toBe(60);
    expect(onSelectedKeyChange).not.toHaveBeenCalled();
  });

  it('keeps a press that stays within the threshold a click', () => {
    const { onSelectedKeyChange } = renderPanHost();
    const scroll = mockScrollGeometry(getScroll(), OVERFLOWING);
    const circle = getCircle(2);

    dragBy(circle, { dx: 3, dy: 0 });
    fireEvent.click(circle);

    expect(scroll.scrollLeft).toBe(100);
    expect(onSelectedKeyChange).toHaveBeenCalledWith(`${REPO}#2`, { push: true });
  });

  it('does not pan a matrix that fits the chart area', () => {
    renderPanHost();
    const scroll = mockScrollGeometry(getScroll(), {
      width: FRAME.width * 2,
      height: FRAME.height * 2,
      left: 0,
      top: 0,
    });

    dragBy(getSvg(), { dx: -50, dy: -30 });

    expect(scroll.scrollLeft).toBe(0);
    expect(scroll.scrollTop).toBe(0);
  });

  it('leaves a touch drag to the browser', () => {
    renderPanHost();
    const scroll = mockScrollGeometry(getScroll(), OVERFLOWING);

    dragBy(getSvg(), { dx: -50, dy: -30 }, 'touch');

    expect(scroll.scrollLeft).toBe(100);
  });

  it('rescores the selected circle by a drag at 200 %, without panning', async () => {
    const user = userEvent.setup();
    const { onScoresChange } = renderPanHost();
    await user.keyboard('+++');
    const scroll = mockScrollGeometry(getScroll(), OVERFLOWING);
    getSvg().getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 0, width: FRAME.width * 2, height: FRAME.height * 2 });
    const circle = getCircle(1);
    await user.click(circle);

    fireEvent.pointerDown(circle, { ...MOUSE, ...centreOf(2, 2, 2) });
    fireEvent.pointerMove(circle, { ...MOUSE, ...centreOf(4, 4, 2) });
    fireEvent.pointerUp(circle, { ...MOUSE, ...centreOf(4, 4, 2) });

    expect(onScoresChange).toHaveBeenCalledWith(FIRST, { urgency: 'critical', value: 'must-have' });
    expect(scroll.scrollLeft).toBe(100);
  });
});

// region | Helpers
/** Returns the client position of a cell's centre in an SVG scaled by `scale` at the viewport's origin. */
function centreOf(u: number, i: number, scale: number): { clientX: number; clientY: number } {
  return {
    clientX: (MARGIN_LEFT + (u + 0.5) * MIN_CELL_SIZE) * scale,
    clientY: (MARGIN_TOP + (GRID_SIZE - 1 - i + 0.5) * MIN_CELL_SIZE) * scale,
  };
}

/** Presses on `target`, moves by the offset in two moves, and releases. */
function dragBy(target: Element, offset: { dx: number; dy: number }, pointerType = 'mouse'): void {
  const start = { clientX: 300, clientY: 200 };
  const pointer = { ...MOUSE, pointerType };
  fireEvent.pointerDown(target, { ...pointer, ...start });
  fireEvent.pointerMove(target, {
    ...pointer,
    clientX: start.clientX + offset.dx / 2,
    clientY: start.clientY + offset.dy / 2,
  });
  const end = { clientX: start.clientX + offset.dx, clientY: start.clientY + offset.dy };
  fireEvent.pointerMove(target, { ...pointer, ...end });
  fireEvent.pointerUp(target, { ...pointer, ...end });
}

function getCircle(number: number): HTMLElement {
  const circle = screen.getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) });
  stubPointerCapture(circle);
  return circle;
}

function getScroll(): HTMLElement {
  // eslint-disable-next-line testing-library/no-node-access -- the scroll container has no role to query.
  const scroll = getSvg().closest<HTMLElement>('.tr-chart-scroll');
  if (!scroll) throw new Error('The chart has no scroll container');
  stubPointerCapture(scroll);
  return scroll;
}

function getSvg(): HTMLElement {
  return screen.getByRole('group', { name: 'Items by urgency and value' });
}

/** Gives the scroll container a client size, a content size at the natural scale, and a settable scroll position. */
function mockScrollGeometry(
  element: HTMLElement,
  geometry: { width: number; height: number; left: number; top: number },
): HTMLElement {
  return Object.defineProperties(element, {
    clientWidth: { configurable: true, value: geometry.width },
    clientHeight: { configurable: true, value: geometry.height },
    scrollWidth: { configurable: true, value: Math.max(FRAME.width, geometry.width) },
    scrollHeight: { configurable: true, value: Math.max(FRAME.height, geometry.height) },
    scrollLeft: { configurable: true, writable: true, value: geometry.left },
    scrollTop: { configurable: true, writable: true, value: geometry.top },
  });
}

function renderPanHost(): {
  onScoresChange: (itemKey: string, changed: Scores) => void;
  onSelectedKeyChange: (key: string | undefined, options: { push: boolean }) => void;
} {
  const onScoresChange = vi.fn<(itemKey: string, changed: Scores) => void>();
  const onSelectedKeyChange = vi.fn<(key: string | undefined, options: { push: boolean }) => void>();
  function PanHost({ items }: { items: WorkItem[] }): ReactElement {
    const [scores, setScores] = useState<Record<string, ItemScores>>(SCORES);
    const [selectedKey, setSelectedKey] = useState<string>();
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onScoresChange={(itemKey, changed) => {
          onScoresChange(itemKey, changed);
          setScores((current) => ({
            ...current,
            [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', '2026-11-09T00:00:00.000Z'),
          }));
        }}
        onSelectedKeyChange={(key, options) => {
          onSelectedKeyChange(key, options);
          setSelectedKey(key);
        }}
        scores={scores}
        selectedKey={selectedKey}
      />
    );
  }
  render(<PanHost items={ITEMS} />);
  return { onScoresChange, onSelectedKeyChange };
}

function stubPointerCapture(element: Element): void {
  element.setPointerCapture = () => {};
  element.hasPointerCapture = () => true;
}
// endregion | Helpers
