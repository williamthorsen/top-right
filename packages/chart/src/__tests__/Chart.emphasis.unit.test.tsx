import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ItemScores, WorkItem } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { scrollIntoChartView } from '../chart-scroll.ts';
import { buildItem, place, renderChart, renderReview, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';

/** Two items share a cell, one sits alone in another, and one is unscored; the first relates to the third. */
const ITEMS = [
  buildItem({
    number: 1,
    relations: [
      {
        kind: 'blocked-by',
        ref: { repo: REPO, number: 3, title: 'Issue 3', url: 'https://example.test/3', state: 'open' },
      },
    ],
  }),
  buildItem({ number: 2 }),
  buildItem({ number: 3 }),
  buildItem({ number: 4 }),
];
const SCORES: Record<string, ItemScores> = {
  [`${REPO}#1`]: place(2, 2),
  [`${REPO}#2`]: place(2, 2),
  [`${REPO}#3`]: place(4, 4),
};

// jsdom lays nothing out, so a test that needs a scroll makes the helper report one.
vi.mock(import('../chart-scroll.ts'), { spy: true });

describe('Chart emphasis', () => {
  describe('while a table row is hovered', () => {
    it("marks the row's circle and fades every other item softly", async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.hover(getTableRow('Issue 2'));

      expect(getCircle(2)).toHaveAttribute('data-highlighted', 'true');
      expect(getCircle(2)).not.toHaveAttribute('data-fade');
      expect(getCircle(1)).toHaveAttribute('data-fade', 'soft');
      expect(getCircle(3)).toHaveAttribute('data-fade', 'soft');
      expect(getGutterRow(4)).toHaveAttribute('data-fade', 'soft');

      await user.unhover(getTableRow('Issue 2'));

      expect(getCircle(1)).not.toHaveAttribute('data-fade');
      expect(getCircle(2)).toHaveAttribute('data-highlighted', 'false');
    });

    it("marks a gutter row's item and fades the circles", async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.hover(getTableRow('Issue 4'));

      expect(getGutterButton(4)).toHaveAttribute('data-highlighted', 'true');
      expect(getGutterRow(4)).not.toHaveAttribute('data-fade');
      expect(getCircle(1)).toHaveAttribute('data-fade', 'soft');
    });

    it("replaces the selection's focus fade, without fading the selected item", async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);
      await user.click(getCircle(1));
      expect(getCircle(3)).not.toHaveAttribute('data-fade');

      await user.hover(getTableRow('Issue 2'));

      expect(getCircle(1)).not.toHaveAttribute('data-fade');
      expect(getCircle(3)).toHaveAttribute('data-fade', 'soft');
    });

    it("leaves a running review's fade in charge", async () => {
      const user = userEvent.setup();
      renderReview(ITEMS, { ...SCORES, [`${REPO}#1`]: agentPlace(2, 2) });
      await user.click(screen.getByRole('button', { name: 'Review agent scores (1)' }));

      await user.hover(getTableRow('Issue 2'));

      expect(getCircle(2)).toHaveAttribute('data-highlighted', 'true');
      expect(getCircle(2)).toHaveAttribute('data-fade', 'strong');
      expect(getCircle(1)).not.toHaveAttribute('data-fade');
    });
  });

  it("marks a relation row's item and fades the rest softly while the row is hovered", async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, {}, SCORES);
    await user.click(getCircle(1));

    await user.hover(within(getPane()).getByRole('button', { name: /Issue 3/ }));

    expect(getCircle(3)).toHaveAttribute('data-highlighted', 'true');
    expect(getCircle(3)).not.toHaveAttribute('data-fade');
    expect(getCircle(2)).toHaveAttribute('data-fade', 'soft');
  });

  describe('when the selection changes', () => {
    let animations: StubAnimation[] = [];
    let prefersReducedMotion = false;

    // jsdom implements neither the Web Animations API nor `matchMedia`.
    beforeEach(() => {
      animations = [];
      prefersReducedMotion = false;
      Object.defineProperty(Element.prototype, 'animate', {
        configurable: true,
        value: function animate(this: Element, keyframes: Keyframe[]) {
          const animation = buildStubAnimation(this, keyframes);
          // The pane's fade-in animates opacity; only a pulse scales.
          if (animation.peak !== undefined) animations.push(animation);
          return animation;
        },
      });
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion }),
      });
    });
    afterEach(() => {
      vi.mocked(scrollIntoChartView).mockRestore();
      vi.useRealTimers();
      Reflect.deleteProperty(Element.prototype, 'animate');
      Reflect.deleteProperty(globalThis, 'matchMedia');
    });

    it('pulses a copy of the circle of an item selected in the table, growing it to 1.2×', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.click(getTableTitle('Issue 2'));

      expect(animations).toHaveLength(1);
      expect(animations[0]?.target).toBe(getPulseCopy());
      expect(animations[0]?.peak).toBe('scale(1.2)');
    });

    it('removes the copy once its pulse finishes', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);
      await user.click(getTableTitle('Issue 2'));

      act(() => animations[0]?.finish());

      expect(getPulseCopy()).toBeNull();
    });

    it('pulses the gutter row of an unscored item selected in the table by less', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.click(getTableTitle('Issue 4'));

      expect(animations).toHaveLength(1);
      expect(animations[0]?.target).toBe(getGutterButton(4));
      expect(animations[0]?.peak).toBe('scale(1.07)');
    });

    it('pulses an item selected from a relation row', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);
      await user.click(getCircle(1));

      await user.click(within(getPane()).getByRole('button', { name: /Issue 3/ }));

      expect(animations).toHaveLength(1);
    });

    it("pulses each item that a review's start and Skip select", async () => {
      const user = userEvent.setup();
      renderReview(ITEMS, { ...SCORES, [`${REPO}#1`]: agentPlace(2, 2), [`${REPO}#3`]: agentPlace(4, 4) });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));
      expect(animations).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Skip' }));
      expect(animations).toHaveLength(2);
    });

    it('waits for the selection to scroll into view before it pulses', async () => {
      const user = userEvent.setup();
      let scrolledChart: Element | undefined;
      vi.mocked(scrollIntoChartView).mockImplementation((_element, chart) => {
        scrolledChart = chart;
        return [chart];
      });
      renderChart(ITEMS, {}, SCORES);

      await user.click(getTableTitle('Issue 2'));
      expect(animations).toHaveLength(0);

      if (!scrolledChart) throw new Error('The selection did not scroll');
      fireEvent(scrolledChart, new Event('scrollend'));
      expect(animations).toHaveLength(1);
    });

    it('pulses once the wait times out when the browser fires no scroll end', () => {
      vi.useFakeTimers();
      vi.mocked(scrollIntoChartView).mockImplementation((_element, chart) => [chart]);
      renderChart(ITEMS, {}, SCORES);

      fireEvent.click(getTableTitle('Issue 2'));
      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(animations).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(animations).toHaveLength(1);
    });

    it('pulses an item that the host selects', () => {
      const onChange = vi.fn<(key: string | undefined) => void>();
      const { rerender } = render(<HostedChart onChange={onChange} selectedKey={undefined} />);

      rerender(<HostedChart onChange={onChange} selectedKey={`${REPO}#3`} />);

      expect(animations).toHaveLength(1);
    });

    it('plays no pulse for a selection made in the matrix', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.click(getCircle(1));
      await user.click(getGutterButton(4));

      expect(animations).toHaveLength(0);
    });

    it('pulses a later selection from the table after a click on the item already selected', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);
      await user.click(getCircle(1));
      act(() => getCircle(1).focus());
      await user.keyboard('{Enter}');
      await user.keyboard('{Escape}');

      await user.click(getTableTitle('Issue 1'));

      expect(animations).toHaveLength(1);
    });

    it('plays no pulse when the reader prefers reduced motion', async () => {
      prefersReducedMotion = true;
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);

      await user.click(getTableTitle('Issue 2'));

      expect(animations).toHaveLength(0);
      expect(getPulseCopy()).toBeNull();
    });

    it('cancels a playing pulse when the selection changes again', async () => {
      const user = userEvent.setup();
      renderChart(ITEMS, {}, SCORES);
      await user.click(getTableTitle('Issue 2'));

      await user.click(getTableTitle('Issue 3'));

      expect(animations).toHaveLength(2);
      expect(animations[0]?.cancel).toHaveBeenCalledOnce();
      expect(animations[1]?.target).toBe(getPulseCopy());
    });

    it('plays no pulse for an item revealed from its ghost', async () => {
      const user = userEvent.setup();
      const items = [
        buildItem({
          number: 1,
          relations: [
            {
              kind: 'blocked-by',
              ref: { repo: REPO, number: 2, title: 'Issue 2', url: 'https://example.test/2', state: 'closed' },
            },
          ],
        }),
        buildItem({ number: 2, state: 'closed' }),
      ];
      renderChart(items, {}, { [`${REPO}#1`]: place(2, 2), [`${REPO}#2`]: place(3, 3) });
      await user.click(getCircle(1));

      await user.click(screen.getByRole('button', { name: 'T.2: Issue 2, done, hidden' }));

      expect(getCircle(2)).toBePressed();
      expect(animations).toHaveLength(0);
    });
  });
});

// region | Helpers
/** An animation stub that records its target and its peak keyframe, and finishes on demand. */
interface StubAnimation {
  target: Element;
  peak: string | undefined;
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/** Returns an animation stub for the element, whose `finish` calls each of its finish listeners. */
function buildStubAnimation(target: Element, keyframes: Keyframe[]): StubAnimation {
  const listeners = new Set<() => void>();
  const peak = keyframes[1]?.['transform'];
  return {
    target,
    peak: typeof peak === 'string' ? peak : undefined,
    cancel: vi.fn(),
    finish: () => {
      for (const listener of listeners) listener();
    },
    addEventListener: (type, listener) => {
      if (type === 'finish') listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
}

/** Renders the chart under a host that holds the selection as `selectedKey`. */
function HostedChart({
  onChange,
  selectedKey,
}: {
  onChange: (key: string | undefined) => void;
  selectedKey: string | undefined;
}) {
  const items: WorkItem[] = ITEMS;
  return (
    <Chart
      abbreviations={{}}
      items={items}
      onSelectedKeyChange={onChange}
      overrides={{}}
      scores={SCORES}
      selectedKey={selectedKey}
    />
  );
}

/** Returns the pulsing copy of a circle in the chart's overlay, which is aria-hidden and so has no role to query. */
function getPulseCopy(): Element | null {
  return document.querySelector('.tr-pulse');
}

/** Returns the button that selects the item with the title from its table row. */
function getTableTitle(title: string): HTMLElement {
  return within(getTableRow(title)).getByRole('button', { name: title });
}

/** Returns scores that place an item as `place` does, written by an agent. */
function agentPlace(u: number, v: number): ItemScores {
  const { urgency, value } = place(u, v);
  if (!urgency || !value) throw new Error('place returned no scores');
  return { urgency: { ...urgency, by: 'agent' }, value: { ...value, by: 'agent' } };
}

/** Returns the item's circle, or its gutter row's button for an unscored item. */
function getCircle(number: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) });
}

/** Returns the button of the item's row in a gutter cell. */
function getGutterButton(number: number): HTMLElement {
  const list = screen.getByRole('list', { name: 'Unscored items' });
  return within(list).getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) });
}

/** Returns the gutter row of the item, which carries the fade rather than its button. */
function getGutterRow(number: number): HTMLElement | null {
  return getGutterButton(number).closest('li');
}

/** Returns the table's row for the item with the title. */
function getTableRow(title: string): HTMLElement {
  const row = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByRole('button', { name: title }) !== null);
  if (!row) throw new Error(`No row for ${title}`);
  return row;
}
// endregion | Helpers
