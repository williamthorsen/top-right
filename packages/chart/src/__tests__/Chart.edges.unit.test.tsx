import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Relation, RelationKind } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, renderReview, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';

describe(Chart, () => {
  describe('with edges', () => {
    // T.1 blocks T.2, which blocks T.3; T.4 is a sub-issue of T.2; T.5 stands apart.
    const chainItems = [
      buildItem({ number: 1, relations: [relate('blocking', 2)] }),
      buildItem({ number: 2, relations: [relate('blocked-by', 1), relate('blocking', 3), relate('sub-issue', 4)] }),
      buildItem({ number: 3, relations: [relate('blocked-by', 2)] }),
      buildItem({ number: 4, relations: [relate('parent', 2)] }),
      buildItem({ number: 5 }),
    ];
    const chainScores = {
      [`${REPO}#1`]: place(1, 1),
      [`${REPO}#2`]: place(2, 2),
      [`${REPO}#3`]: place(3, 3),
      [`${REPO}#4`]: place(4, 3),
      [`${REPO}#5`]: place(4, 4),
    };

    it('draws no edge at rest', () => {
      renderChart(chainItems, {}, chainScores);

      expect(listEdges()).toStrictEqual([]);
    });

    it('when a circle is hovered, draws its own edges, and lightly fades every unrelated circle', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      await user.hover(screen.getByRole('button', { name: /^T\.2:/ }));

      expect(listEdges()).toStrictEqual(['blocker:1>2:direct', 'blocker:2>3:direct', 'sub-issue:4>2:direct']);
      expect(screen.getByRole('button', { name: /^T\.5:/ })).toHaveAttribute('data-fade', 'soft');
      expect(screen.getByRole('button', { name: /^T\.4:/ })).not.toHaveAttribute('data-fade');
      expect(screen.getByRole('button', { name: /^T\.2:/ })).not.toHaveAttribute('data-fade');
    });

    it('when a circle is selected, draws its blocker chain at reduced weight and keeps a faded circle selectable', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      await user.unhover(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(listEdges()).toStrictEqual(['blocker:2>3:chain', 'blocker:1>2:direct']);
      expect(screen.getByRole('button', { name: /^T\.4:/ })).toHaveAttribute('data-fade', 'soft');

      await user.click(screen.getByRole('button', { name: /^T\.4:/ }));
      expect(screen.getByRole('button', { name: /^T\.4:/ })).toBePressed();
    });

    it('lightly fades an unrelated gutter row while a circle is hovered', async () => {
      const user = userEvent.setup();
      const { [`${REPO}#5`]: _, ...scoresWithoutFive } = chainScores;
      renderChart(chainItems, {}, scoresWithoutFive);

      await user.hover(screen.getByRole('button', { name: /^T\.2:/ }));

      const row = within(screen.getByRole('list', { name: 'Unscored items' })).getByRole('button', { name: /^T\.5:/ });
      // eslint-disable-next-line testing-library/no-node-access -- the row, which carries the fade, has no role to query.
      expect(row.closest('li')).toHaveAttribute('data-fade', 'soft');
    });

    it('fades nothing while a circle without relations is selected', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      await user.click(screen.getByRole('button', { name: /^T\.5:/ }));

      for (const number of [1, 2, 3, 4, 5]) {
        expect(screen.getByRole('button', { name: new RegExp(String.raw`^T\.${number}:`) })).not.toHaveAttribute(
          'data-fade',
        );
      }
    });

    it('with All edges on, draws every edge once, faintly when nothing is focused', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      const allEdges = screen.getByRole('switch', { name: 'All edges' });

      await user.click(allEdges);

      expect(allEdges).toBeChecked();
      expect(listEdges()).toStrictEqual(['blocker:1>2:faint', 'blocker:2>3:faint', 'sub-issue:4>2:faint']);
    });

    it('during a review, fades by the queue rather than by focus', async () => {
      const user = userEvent.setup();
      const at = '2026-11-08T00:00:00.000Z';
      renderReview(chainItems, {
        ...chainScores,
        [`${REPO}#5`]: {
          urgency: { score: 'high', by: 'agent', at },
          value: { score: 'should-have', by: 'agent', at },
        },
      });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (1)' }));

      expect(screen.getByRole('button', { name: /^T\.5:/ })).not.toHaveAttribute('data-fade');
      expect(screen.getByRole('button', { name: /^T\.2:/ })).toHaveAttribute('data-fade', 'strong');
    });

    it('draws a blocker cycle', async () => {
      const user = userEvent.setup();
      const cycle = [
        buildItem({ number: 1, relations: [relate('blocking', 2)] }),
        buildItem({ number: 2, relations: [relate('blocking', 1)] }),
      ];
      renderChart(cycle, {}, { [`${REPO}#1`]: place(1, 1), [`${REPO}#2`]: place(3, 3) });

      await user.hover(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(listEdges()).toStrictEqual(['blocker:1>2:direct', 'blocker:2>1:direct']);
    });

    it('rings a blocked item, in its cell and in the gutter, and names it blocked', () => {
      const inGutter = buildItem({ number: 6, relations: [relate('blocked-by', 1)] });
      renderChart([...chainItems, inGutter], {}, chainScores);

      const circle = screen.getByRole('button', { name: /^T\.2:.*, blocked$/ });
      expect(hasMark(circle, 'tr-node-blocked')).toBe(true);
      expect(hasMark(screen.getByRole('button', { name: /^T\.1:/ }), 'tr-node-blocked')).toBe(false);
      const row = within(screen.getByRole('list', { name: 'Unscored items' })).getByRole('button', {
        name: /^T\.6:.*, blocked$/,
      });
      expect(hasMark(row, 'tr-circle-blocked')).toBe(true);
    });

    it('while nothing is hovered or selected, shows no item in the pane', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      expect(getPane()).toHaveTextContent('No item selected');
      expect(getPane()).not.toHaveTextContent('Issue 5');

      await user.click(screen.getByRole('button', { name: /^T\.4:/ }));
      expect(getPane()).toHaveTextContent('Selected');
      expect(getPane()).toHaveTextContent('Issue 4');
    });

    it("when a relation row in the pane is hovered, rings that row's circle", async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      await user.click(screen.getByRole('button', { name: /^T\.2:/ }));

      const row = within(getPane()).getByRole('button', { name: /T\.3 Issue 3/ });
      await user.hover(row);
      expect(screen.getByRole('button', { name: /^T\.3:/ })).toHaveAttribute('data-highlighted', 'true');

      await user.unhover(row);
      expect(screen.getByRole('button', { name: /^T\.3:/ })).toHaveAttribute('data-highlighted', 'false');
    });

    it("ends a relation row's highlight when the pane leaves its item under the pointer", async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      await user.click(screen.getByRole('button', { name: /^T\.2:/ }));
      await user.hover(within(getPane()).getByRole('button', { name: /T\.3 Issue 3/ }));

      await user.keyboard('{Escape}');

      expect(screen.getByRole('button', { name: /^T\.3:/ })).toHaveAttribute('data-highlighted', 'false');
    });
  });
});

// region | Helpers
/** Returns whether the item wears the mark of `className`, which is decorative SVG without a role to query. */
function hasMark(element: HTMLElement, className: string): boolean {
  return element.querySelector(`.${className}`) !== null;
}

/** Returns each drawn edge as `kind:from>to:weight` by issue number, in draw order; edges are decorative SVG. */
function listEdges(): string[] {
  const group = screen.getByRole('group', { name: 'Items by urgency and value' });
  return Array.from(group.querySelectorAll<SVGGElement>('.tr-edge'), ({ dataset }) => {
    const ends = (dataset['ends'] ?? '').replaceAll(`${REPO}#`, '');
    return `${dataset['kind']}:${ends}:${dataset['weight']}`;
  });
}

function relate(kind: RelationKind, number: number): Relation {
  return {
    kind,
    ref: { repo: REPO, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state: 'open' },
  };
}
// endregion | Helpers
