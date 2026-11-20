import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ItemScores } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP, measureFrame } from '../Grid.tsx';
import { GRID_SIZE, MIN_CELL_SIZE } from '../layout.ts';
import { buildItem, place, REPO } from '../test-utils/chart-fixtures.tsx';
import { reportResize } from '../test-utils/resize-observer.ts';
import { CALLOUT_DWELL } from '../useCellHover.ts';

/** The chart's size in chart units at the smallest cell, which the mocked SVG box draws at 1×. */
const FRAME = measureFrame(MIN_CELL_SIZE);
const MOUSE = { pointerId: 1, pointerType: 'mouse' };
/** Room beside the frame for a lane, and room for none. */
const WIDE = FRAME.width + 400;
const NARROW = FRAME.width + 100;

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

describe('Chart titles lane', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows every scored title by urgency once Titles is on, and enables Lines only then', () => {
    renderTitlesHost();

    expect(listLane()).toStrictEqual([]);
    expect(getSwitch('Lines')).toBeDisabled();

    fireEvent.click(getSwitch('Titles'));

    expect(getSwitch('Titles')).toBeChecked();
    expect(getSwitch('Lines')).toBeEnabled();
    expect(listLane()).toStrictEqual([
      'Critical urgency',
      'T.3Third issue',
      'Medium urgency',
      'T.1First issue',
      'T.2Second issue',
    ]);
    // eslint-disable-next-line testing-library/no-node-access -- the layer is aria-hidden and has no role to query.
    expect(document.querySelector('.tr-title-lane-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(getScroll()).toHaveAttribute('data-titles', 'true');
  });

  it('draws a leader per row while Lines is on, and none once it is off', () => {
    renderTitlesHost();
    fireEvent.click(getSwitch('Titles'));

    expect(listLeaders()).toHaveLength(3);

    fireEvent.click(getSwitch('Lines'));

    expect(listLeaders()).toStrictEqual([]);
  });

  it('selects the item of a clicked row and draws its leader with Lines off', () => {
    renderTitlesHost();
    fireEvent.click(getSwitch('Titles'));
    fireEvent.click(getSwitch('Lines'));

    fireEvent.click(getRow('Third issue'));

    expect(getCircle(3)).toHaveAttribute('aria-pressed', 'true');
    expect(listLeaders()).toStrictEqual(['selected']);
  });

  it('draws the leader of a hovered row with Lines off', () => {
    renderTitlesHost();
    fireEvent.click(getSwitch('Titles'));
    fireEvent.click(getSwitch('Lines'));

    fireEvent.pointerEnter(getRow('First issue'), MOUSE);

    expect(listLeaders()).toStrictEqual(['hovered']);

    fireEvent.pointerLeave(getRow('First issue'), MOUSE);

    expect(listLeaders()).toStrictEqual([]);
  });

  it('narrows the lane to a rested cell in place of its callouts until the pointer leaves both', () => {
    renderTitlesHost();
    fireEvent.click(getSwitch('Titles'));

    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    expect(listLane()).toStrictEqual(['Medium urgency · Nice to have', 'T.1First issue', 'T.2Second issue']);
    expect(listCallouts()).toStrictEqual([]);

    fireEvent.pointerMove(getRow('First issue'), MOUSE);
    elapse(CALLOUT_DWELL);
    expect(listLane()).toHaveLength(3);

    fireEvent.pointerLeave(getScroll(), MOUSE);
    expect(listLane()).toHaveLength(5);
  });

  it('keeps the selected item above a narrowed cell that does not hold it', () => {
    renderTitlesHost();
    fireEvent.click(getSwitch('Titles'));
    fireEvent.click(getRow('Third issue'));

    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    expect(listLane()).toStrictEqual([
      'Selected',
      'T.3Third issue',
      'Medium urgency · Nice to have',
      'T.1First issue',
      'T.2Second issue',
    ]);
  });

  it('says that the titles have no room, and keeps the callouts, when the area is too narrow for the lane', () => {
    renderTitlesHost(NARROW);
    fireEvent.click(getSwitch('Titles'));

    expect(screen.getByText('No room for titles: widen the window or zoom out')).toBeInTheDocument();
    expect(listLane()).toStrictEqual([]);
    expect(getScroll()).toHaveAttribute('data-titles', 'false');

    hoverCorner(2, 2);
    elapse(CALLOUT_DWELL);

    expect(listCallouts().toSorted()).toStrictEqual(['T.1First issue', 'T.2Second issue']);
  });

  it('reports the switches to a host that holds them', () => {
    const onShowTitlesChange = vi.fn();
    const onShowLinesChange = vi.fn();
    render(
      <Chart
        abbreviations={{}}
        items={ITEMS}
        onShowLinesChange={onShowLinesChange}
        onShowTitlesChange={onShowTitlesChange}
        scores={SCORES}
        showLines
        showTitles
      />,
    );

    expect(getSwitch('Titles')).toBeChecked();

    fireEvent.click(getSwitch('Titles'));
    fireEvent.click(getSwitch('Lines'));

    expect(onShowTitlesChange).toHaveBeenCalledWith(false);
    expect(onShowLinesChange).toHaveBeenCalledWith(false);
    expect(getSwitch('Titles')).toBeChecked();
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

/** Returns a lane row's button, which is hidden from the accessibility tree. */
function getRow(title: string): HTMLElement {
  // eslint-disable-next-line testing-library/no-node-access -- the lane is aria-hidden and has no role to query.
  const row = Array.from(document.querySelectorAll<HTMLElement>('.tr-title')).find((each) =>
    each.textContent.endsWith(title),
  );
  if (!row) throw new Error(`The lane has no row for ${title}`);
  return row;
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

function getSwitch(name: string): HTMLElement {
  return screen.getByRole('switch', { name });
}

function hoverCorner(u: number, v: number, inset?: number): void {
  fireEvent.pointerMove(getSvg(), { ...MOUSE, ...cornerOf(u, v, inset) });
}

/** Returns each callout's text; the callouts are hidden from the accessibility tree. */
function listCallouts(): string[] {
  return Array.from(document.querySelectorAll('.tr-callout'), (callout) => callout.textContent);
}

/** Returns each row of the lane as its text, headings included. */
function listLane(): string[] {
  return Array.from(document.querySelectorAll('.tr-title-lane > li'), (row) => row.textContent);
}

/** Returns each drawn leader's state, empty for a leader that Lines alone draws. */
function listLeaders(): string[] {
  return Array.from(
    document.querySelectorAll<SVGLineElement>('.tr-title-leaders line'),
    (line) => line.dataset['state'] ?? '',
  );
}

/** Renders the chart in a chart area `areaWidth` wide, and gives the SVG a 1× box at the viewport's origin. */
function renderTitlesHost(areaWidth = WIDE): void {
  render(<Chart abbreviations={{}} items={ITEMS} scores={SCORES} />);
  const scroll = getScroll();
  Object.defineProperties(scroll, {
    clientWidth: { configurable: true, value: areaWidth },
    clientHeight: { configurable: true, value: FRAME.height },
  });
  act(() => reportResize(scroll));
  getSvg().getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: FRAME.width, height: FRAME.height });
}
// endregion | Helpers
