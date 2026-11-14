import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ItemScores } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP, measureFrame } from '../Grid.tsx';
import { GRID_SIZE, MIN_CELL_SIZE } from '../layout.ts';
import { buildItem, place, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';
import { CALLOUT_DWELL } from '../useCellHover.ts';

/** The chart's size in chart units at the smallest cell, which the mocked SVG box draws at 1×. */
const FRAME = measureFrame(MIN_CELL_SIZE);
const MOUSE = { pointerId: 1, pointerType: 'mouse' };

/** Two items share a cell, one sits alone in another, and one is unscored. */
const ITEMS = [
  buildItem({ number: 1, title: 'First issue' }),
  buildItem({ number: 2, title: 'Second issue' }),
  buildItem({ number: 3, title: 'Third issue' }),
  buildItem({ number: 4, title: 'Fourth issue' }),
];
const SCORES: Record<string, ItemScores> = {
  [`${REPO}#1`]: place(2, 2),
  [`${REPO}#2`]: place(2, 2),
  [`${REPO}#3`]: place(4, 4),
};

describe('Chart cell callouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a callout per circle of a cell once the pointer rests on an empty spot, and fades the other cells', () => {
    renderCalloutHost();

    hoverCorner(2, 2);

    expect(listCallouts()).toStrictEqual([]);
    elapse(CALLOUT_DWELL);
    expect(listCallouts().toSorted()).toStrictEqual(['T.1First issue', 'T.2Second issue']);
    // eslint-disable-next-line testing-library/no-node-access -- the layer is aria-hidden and has no role to query.
    expect(document.querySelector('.tr-callout-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(getCircle(1)).not.toHaveAttribute('data-fade');
    expect(getCircle(3)).toHaveAttribute('data-fade', 'soft');
    expect(getGutterRow(4)).toHaveAttribute('data-fade', 'soft');
  });

  it('keeps the callouts through a move within the cell', () => {
    renderCalloutHost();
    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    hoverCorner(2, 2, 12);

    expect(listCallouts()).toHaveLength(2);
  });

  it('removes the callouts when the pointer leaves the cell, moves onto a circle, or presses', () => {
    renderCalloutHost();
    const cases = [
      () => hoverCorner(3, 3),
      () => fireEvent.pointerMove(getCircle(1), { ...MOUSE, ...cornerOf(2, 2) }),
      () => fireEvent.pointerDown(getSvg(), { ...MOUSE, button: 0, buttons: 1, ...cornerOf(2, 2) }),
      () => fireEvent.pointerLeave(getScroll(), MOUSE),
    ];

    for (const leave of cases) {
      hoverCorner(2, 2);
      elapse(CALLOUT_DWELL);
      expect(listCallouts()).toHaveLength(2);
      leave();
      expect(listCallouts()).toStrictEqual([]);
      expect(getCircle(3)).not.toHaveAttribute('data-fade');
      // Restart the dwell from outside the cell, so that the next case's hover is a change of cell.
      hoverCorner(3, 3);
    }
  });

  it('shows nothing while a button is held, for a touch pointer, or over a gutter', () => {
    renderCalloutHost();

    fireEvent.pointerMove(getSvg(), { ...MOUSE, buttons: 1, ...cornerOf(2, 2) });
    elapse(CALLOUT_DWELL);
    expect(listCallouts()).toStrictEqual([]);

    fireEvent.pointerMove(getSvg(), { ...MOUSE, pointerType: 'touch', ...cornerOf(2, 2) });
    elapse(CALLOUT_DWELL);
    expect(listCallouts()).toStrictEqual([]);

    hoverCorner(0, 0);
    elapse(CALLOUT_DWELL);
    expect(listCallouts()).toStrictEqual([]);
  });

  it('changes neither the selection nor the pane', () => {
    const { onSelectedKeyChange } = renderCalloutHost();

    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    expect(onSelectedKeyChange).not.toHaveBeenCalled();
    expect(getPane()).toHaveTextContent('No item selected');
  });

  it('leaves a running review its own fade', () => {
    renderCalloutHost();
    fireEvent.click(screen.getByRole('button', { name: /^Review unscored/ }));

    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    expect(listCallouts()).toHaveLength(2);
    expect(getCircle(1)).toHaveAttribute('data-fade', 'strong');
    expect(getCircle(3)).toHaveAttribute('data-fade', 'strong');
  });
});

// region | Helpers
/** Returns the client position just inside a cell's top-left corner, offset by `inset`, in the SVG at the origin. */
function cornerOf(u: number, v: number, inset = 4): { clientX: number; clientY: number } {
  return {
    clientX: MARGIN_LEFT + u * MIN_CELL_SIZE + inset,
    clientY: MARGIN_TOP + (GRID_SIZE - 1 - v) * MIN_CELL_SIZE + inset,
  };
}

function elapse(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function getCircle(number: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) });
}

/** Returns the gutter row of the item, which carries the fade rather than its button. */
function getGutterRow(number: number): HTMLElement | null {
  const list = screen.getByRole('list', { name: 'Unscored items' });
  return within(list)
    .getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) })
    .closest('li');
}

function getScroll(): HTMLElement {
  // eslint-disable-next-line testing-library/no-node-access -- the scroll container has no role to query.
  const scroll = getSvg().closest<HTMLElement>('.tr-chart-scroll');
  if (!scroll) throw new Error('The chart has no scroll container');
  return scroll;
}

function getSvg(): HTMLElement {
  return screen.getByRole('group', { name: 'Items by urgency and value' });
}

function hoverCorner(u: number, v: number, inset?: number): void {
  fireEvent.pointerMove(getSvg(), { ...MOUSE, ...cornerOf(u, v, inset) });
}

/** Returns each callout's text; the callouts are hidden from the accessibility tree. */
function listCallouts(): string[] {
  return Array.from(document.querySelectorAll('.tr-callout'), (callout) => callout.textContent);
}

/** Renders the chart with a host spy for selection, and gives the SVG a 1× box at the viewport's origin. */
function renderCalloutHost(): { onSelectedKeyChange: ReturnType<typeof vi.fn> } {
  const onSelectedKeyChange = vi.fn();
  render(
    <Chart
      abbreviations={{}}
      items={ITEMS}
      onSelectedKeyChange={onSelectedKeyChange}
      scores={SCORES}
      selectedKey={undefined}
    />,
  );
  getSvg().getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: FRAME.width, height: FRAME.height });
  return { onSelectedKeyChange };
}
// endregion | Helpers
