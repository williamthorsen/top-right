import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WorkItem } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';

// T.1 is scored and blocks T.2, which is unscored and so sits in a gutter row; T.3 is scored.
const items: WorkItem[] = [
  buildItem({
    number: 1,
    relations: [
      {
        kind: 'blocking',
        ref: { repo: REPO, number: 2, title: 'Issue 2', url: 'https://example.test/2', state: 'open' },
      },
    ],
  }),
  buildItem({ number: 2 }),
  buildItem({ number: 3 }),
];
const scores = { [`${REPO}#1`]: place(3, 3), [`${REPO}#3`]: place(2, 2) };

describe(Chart, () => {
  describe('when the selection changes', () => {
    let prefersReducedMotion = false;

    // jsdom does not implement `matchMedia`.
    beforeEach(() => {
      prefersReducedMotion = false;
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion }),
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'matchMedia');
    });

    it('smoothly scrolls the gutter row of an item selected in the table into view, as near as it lies', async () => {
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      expect(listChartCalls(scrollIntoView)).toEqual([
        { element: getMark(2), options: { behavior: 'smooth', block: 'nearest', inline: 'nearest' } },
      ]);
    });

    it('scrolls instantly when the reader prefers reduced motion', async () => {
      prefersReducedMotion = true;
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      expect(listChartCalls(scrollIntoView)).toEqual([
        { element: getMark(2), options: { behavior: 'instant', block: 'nearest', inline: 'nearest' } },
      ]);
    });

    it('scrolls the circle of a scored item selected in the table into view', async () => {
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 3' }));

      expect(listChartCalls(scrollIntoView).map(({ element }) => element)).toEqual([getMark(3)]);
    });

    it('scrolls the gutter row of an item selected through a relation row in the pane into view', async () => {
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderChart(items, {}, scores);
      await user.click(getMark(1));

      await user.click(within(getPane()).getByRole('button', { name: /^T\.2 Issue 2/ }));

      expect(listChartCalls(scrollIntoView).map(({ element }) => element)).toEqual([getMark(1), getMark(2)]);
    });

    it('scrolls the gutter row of an item that the host selects on load into view', () => {
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');

      render(
        <Chart
          abbreviations={{}}
          items={items}
          onSelectedKeyChange={() => undefined}
          scores={scores}
          selectedKey={`${REPO}#2`}
        />,
      );

      expect(listChartCalls(scrollIntoView).map(({ element }) => element)).toEqual([getMark(2)]);
    });

    it('does not scroll again while the selection stays the same, nor when it clears', async () => {
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      const { rerender } = render(<Chart abbreviations={{}} items={items} scores={scores} />);
      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      rerender(<Chart abbreviations={{}} items={[...items]} scores={{ ...scores }} />);
      await user.click(within(getPane()).getByRole('button', { name: 'Close' }));

      expect(listChartCalls(scrollIntoView)).toHaveLength(1);
    });
  });
});

// region | Helpers
/** Returns the table of items. */
function getTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Items' });
}

/** Returns the circle or gutter row of the item numbered `number`. */
function getMark(number: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) });
}

/** Returns the chart's calls to the spy, leaving out the table's, which scrolls its own selected row into view. */
function listChartCalls(
  scrollIntoView: MockInstance<Element['scrollIntoView']>,
): { element: Element; options: unknown }[] {
  const calls: { element: Element; options: unknown }[] = [];
  for (const [index, args] of scrollIntoView.mock.calls.entries()) {
    const element: unknown = scrollIntoView.mock.contexts[index];
    if (element instanceof Element && !(element instanceof HTMLTableRowElement))
      calls.push({ element, options: args[0] });
  }
  return calls;
}
// endregion | Helpers
