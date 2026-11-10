import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { applyScoreWrite, type ItemScores, type Scores, type WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { HEIGHT, MARGIN_LEFT, MARGIN_TOP, WIDTH } from '../Grid.tsx';
import { CELL_SIZE, GRID_SIZE } from '../layout.ts';
import { buildItem, place, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';

const FIRST = `${REPO}#1`;

describe('Chart drag', () => {
  it('moves the selected circle to the scored cell on which it is dropped, with one write of both scores', async () => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(4, 4) });
    expect(countMarks('.tr-drop-target')).toBe(1);
    expect(countMarks('.tr-drag-proxy')).toBe(1);
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(4, 4) });

    expect(onScoresChange).toHaveBeenCalledTimes(1);
    expect(onScoresChange).toHaveBeenCalledWith(FIRST, { urgency: 'critical', value: 'must-have' });
    expect(countMarks('.tr-drop-target')).toBe(0);
    expect(countMarks('.tr-drag-proxy')).toBe(0);
  });

  it('ignores the click that ends a drag, so that a drop pushes no selection', async () => {
    const { onSelectedKeyChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);
    onSelectedKeyChange.mockClear();

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(0, 3) });
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(0, 3) });
    fireEvent.click(circle);

    expect(onSelectedKeyChange).not.toHaveBeenCalled();
  });

  it('selects the next item clicked after a drop moves the dragged one', async () => {
    const user = userEvent.setup();
    renderDragHost([buildItem({ number: 1 }), buildItem({ number: 2 })], {
      [FIRST]: place(2, 2),
      [`${REPO}#2`]: place(3, 3),
    });
    const circle = getCircle(1);
    await user.click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(4, 4) });
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(4, 4) });
    await user.click(getCircle(2));

    expect(getCircle(2)).toBePressed();
  });

  it('does not highlight the circle’s own cell', async () => {
    renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, {
      pointerId: 1,
      clientX: centreOf(2, 2).clientX + 20,
      clientY: centreOf(2, 2).clientY,
    });

    expect(countMarks('.tr-drag-proxy')).toBe(1);
    expect(countMarks('.tr-drop-target')).toBe(0);
  });

  it.each([
    { case: 'its own cell', end: centreOf(2, 2) },
    { case: 'a gutter', end: centreOf(0, 3) },
    { case: 'a point off the matrix', end: { clientX: 2, clientY: 2 } },
  ])('writes nothing for a drop on $case', async ({ end }) => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(3, 3) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...end });
    fireEvent.pointerUp(circle, { pointerId: 1, ...end });

    expect(onScoresChange).not.toHaveBeenCalled();
  });

  it('writes nothing when the pointer is cancelled', async () => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(4, 4) });
    fireEvent.pointerCancel(circle, { pointerId: 1 });
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(4, 4) });

    expect(onScoresChange).not.toHaveBeenCalled();
    expect(countMarks('.tr-drag-proxy')).toBe(0);
  });

  it('does not drag a circle that is not selected', () => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, { pointerId: 1, ...centreOf(4, 4) });
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(4, 4) });

    expect(countMarks('.tr-drag-proxy')).toBe(0);
    expect(onScoresChange).not.toHaveBeenCalled();
  });

  it('keeps a touch on the selected circle from scrolling, and a touch elsewhere free to', async () => {
    renderDragHost([buildItem({ number: 1 }), buildItem({ number: 2 })], {
      [FIRST]: place(2, 2),
      [`${REPO}#2`]: place(3, 3),
    });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    expect(fireEvent.touchMove(circle)).toBe(false);
    expect(fireEvent.touchMove(getCircle(2))).toBe(true);
  });

  it('treats a press that barely moves as a click', async () => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], { [FIRST]: place(2, 2) });
    const circle = getCircle(1);
    await userEvent.setup().click(circle);

    fireEvent.pointerDown(circle, { pointerId: 1, ...centreOf(2, 2) });
    fireEvent.pointerMove(circle, {
      pointerId: 1,
      clientX: centreOf(2, 2).clientX + 3,
      clientY: centreOf(2, 2).clientY,
    });

    expect(countMarks('.tr-drag-proxy')).toBe(0);
    fireEvent.pointerUp(circle, { pointerId: 1, ...centreOf(2, 2) });
    expect(onScoresChange).not.toHaveBeenCalled();
  });

  it('drags a selected gutter row to a scored cell', async () => {
    const { onScoresChange } = renderDragHost([buildItem({ number: 1 })], {});
    const row = within(screen.getByRole('list', { name: 'Unscored items' })).getByRole('button', { name: /^t\.1:/ });
    await userEvent.setup().click(row);
    stubPointerCapture(row);

    fireEvent.pointerDown(row, { pointerId: 1, ...centreOf(0, 0) });
    fireEvent.pointerMove(row, { pointerId: 1, ...centreOf(3, 4) });
    fireEvent.pointerUp(row, { pointerId: 1, ...centreOf(3, 4) });

    expect(onScoresChange).toHaveBeenCalledWith(FIRST, { urgency: 'high', value: 'must-have' });
  });

  it('moves an Unscored review on once a drop places the selected item', async () => {
    const user = userEvent.setup();
    renderDragHost([buildItem({ number: 1 }), buildItem({ number: 2 })], {});

    await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
    expect(within(getPane()).getByText('Issue 1')).toBeInTheDocument();
    const row = within(screen.getByRole('list', { name: 'Unscored items' })).getByRole('button', { name: /^t\.1:/ });
    stubPointerCapture(row);

    fireEvent.pointerDown(row, { pointerId: 1, ...centreOf(0, 0) });
    fireEvent.pointerMove(row, { pointerId: 1, ...centreOf(3, 4) });
    fireEvent.pointerUp(row, { pointerId: 1, ...centreOf(3, 4) });

    expect(await within(getPane()).findByText('Issue 2')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · 1 of 1');
  });
});

// region | Helpers
/** Returns the client position of a cell's centre, with the chart drawn at 1× from the viewport's origin. */
function centreOf(u: number, i: number): { clientX: number; clientY: number } {
  return {
    clientX: MARGIN_LEFT + (u + 0.5) * CELL_SIZE,
    clientY: MARGIN_TOP + (GRID_SIZE - 1 - i + 0.5) * CELL_SIZE,
  };
}

/** Counts the drag's marks in the chart's layers, which include the overlay that draws the proxy above the gutters. */
function countMarks(selector: string): number {
  // eslint-disable-next-line testing-library/no-node-access -- the layers' shared box has no role to query.
  const canvas = screen.getByRole('group', { name: 'Items by urgency and value' }).closest('.tr-canvas');
  return canvas?.querySelectorAll(selector).length ?? 0;
}

/** Returns the scored circle of the item numbered `number`, with its pointer capture stubbed. */
function getCircle(number: number): HTMLElement {
  const circle = screen.getByRole('button', { name: new RegExp(String.raw`^t\.${number}:`) });
  stubPointerCapture(circle);
  return circle;
}

/**
 * Renders the chart with a host that applies the author's writes and holds the selection, as the page does, and lays
 * the chart out at 1× from the viewport's origin, which jsdom does not lay out.
 */
function renderDragHost(items: WorkItem[], initialScores: Record<string, ItemScores>) {
  const onScoresChange = vi.fn<(itemKey: string, changed: Scores) => void>();
  const onSelectedKeyChange = vi.fn<(key: string | undefined, options: { push: boolean }) => void>();
  function DragHost(): ReactElement {
    const [scores, setScores] = useState(initialScores);
    const [selectedKey, setSelectedKey] = useState<string>();
    const at = '2026-11-09T00:00:00.000Z';
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onScoresChange={(itemKey, changed) => {
          onScoresChange(itemKey, changed);
          setScores((current) => ({ ...current, [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', at) }));
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
  render(<DragHost />);
  const svg = screen.getByRole('group', { name: 'Items by urgency and value' });
  svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  return { onScoresChange, onSelectedKeyChange };
}

/** Stubs the pointer capture that jsdom does not implement, as held from the first press. */
function stubPointerCapture(element: Element): void {
  element.setPointerCapture = () => {};
  element.hasPointerCapture = () => true;
}
// endregion | Helpers
