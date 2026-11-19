import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WorkItem } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { scrollIntoChartView } from '../chart-scroll.ts';
import { buildItem, place, renderChart, renderReview, REPO } from '../test-utils/chart-fixtures.tsx';
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

// jsdom lays nothing out, so the calls that the chart makes are what the tests observe.
vi.mock(import('../chart-scroll.ts'), { spy: true });

describe(Chart, () => {
  describe('when the selection changes', () => {
    let prefersReducedMotion = false;

    // jsdom does not implement `matchMedia`.
    beforeEach(() => {
      prefersReducedMotion = false;
      vi.mocked(scrollIntoChartView).mockClear();
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion }),
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'matchMedia');
    });

    it("smoothly scrolls the gutter row of an item selected in the table into the chart's view", async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      expect(listCalls()).toEqual([{ element: getMark(2), behavior: 'smooth' }]);
    });

    it('scrolls instantly when the reader prefers reduced motion', async () => {
      prefersReducedMotion = true;
      const user = userEvent.setup();
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      expect(listCalls()).toEqual([{ element: getMark(2), behavior: 'instant' }]);
    });

    it('scrolls the circle of a scored item selected in the table into view', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);

      await user.click(within(getTable()).getByRole('button', { name: 'Issue 3' }));

      expect(listCalls().map(({ element }) => element)).toEqual([getMark(3)]);
    });

    it('scrolls the gutter row of an item selected through a relation row in the pane into view', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(getMark(1));

      await user.click(within(getPane()).getByRole('button', { name: /^T\.2 Issue 2/ }));

      expect(listCalls().map(({ element }) => element)).toEqual([getMark(1), getMark(2)]);
    });

    it('scrolls each gutter row that the Unscored review moves to into view', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {});

      await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
      await user.click(screen.getByRole('button', { name: 'Skip' }));

      expect(listCalls().map(({ element }) => element)).toEqual([getMark(1), getMark(2)]);
    });

    it('scrolls the gutter row of an item that the host selects on load into view', () => {
      render(
        <Chart
          abbreviations={{}}
          items={items}
          onSelectedKeyChange={() => undefined}
          scores={scores}
          selectedKey={`${REPO}#2`}
        />,
      );

      expect(listCalls().map(({ element }) => element)).toEqual([getMark(2)]);
    });

    it('does not scroll again while the selection stays the same, nor when it clears', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Chart abbreviations={{}} items={items} scores={scores} />);
      await user.click(within(getTable()).getByRole('button', { name: 'Issue 2' }));

      rerender(<Chart abbreviations={{}} items={[...items]} scores={{ ...scores }} />);
      await user.click(within(getPane()).getByRole('button', { name: 'Close' }));

      expect(listCalls()).toHaveLength(1);
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

/** Returns each element that the chart scrolled into its view, with the scroll's behavior. */
function listCalls(): { element: Element; behavior: ScrollBehavior }[] {
  return vi.mocked(scrollIntoChartView).mock.calls.map(([element, , behavior]) => ({ element, behavior }));
}
// endregion | Helpers
