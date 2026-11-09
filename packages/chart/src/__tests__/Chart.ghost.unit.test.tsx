import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Relation, RelationKind, WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';

// t.1 is open and blocked by t.2, which is closed; t.3 is closed and unrelated; t.4 is closed, related, and unscored.
const items: WorkItem[] = [
  buildItem({ number: 1, relations: [relate('blocked-by', 2), relate('sub-issue', 4)] }),
  buildItem({ number: 2, state: 'closed', relations: [relate('blocking', 1)] }),
  buildItem({ number: 3, state: 'closed' }),
  buildItem({ number: 4, state: 'closed', relations: [relate('parent', 1)] }),
];
const scores = {
  [`${REPO}#1`]: place(3, 3),
  [`${REPO}#2`]: place(4, 4),
  [`${REPO}#3`]: place(4, 4),
};
const GHOST_NAME = 't.2: Issue 2, done, hidden';

describe(Chart, () => {
  describe('with a hidden done item at the end of an edge', () => {
    it('draws no ghost at rest', () => {
      renderChart(items, {}, scores);

      expect(screen.queryByRole('button', { name: GHOST_NAME })).not.toBeInTheDocument();
    });

    it('draws a ghost with the edge to it while the related item is hovered, without moving the circle', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      const circle = screen.getByRole('button', { name: /^t\.1:/ });
      const position = circle.getAttribute('transform');

      await user.hover(circle);

      expect(screen.getByRole('button', { name: GHOST_NAME })).toBeInTheDocument();
      expect(listEdgeEnds()).toStrictEqual(['2>1']);
      expect(circle).toHaveAttribute('transform', position);
    });

    it('draws no ghost for an unscored done item or an unrelated one', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);

      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));

      expect(screen.queryByRole('button', { name: /^t\.4:/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^t\.3:/ })).not.toBeInTheDocument();
    });

    it('when the ghost is clicked, selects and reveals that item alone and leaves Done off', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));

      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      expect(screen.getByRole('button', { name: /^t\.2: Issue 2$/ })).toBePressed();
      expect(screen.queryByRole('button', { name: /^t\.3:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Done/ })).not.toBePressed();
    });

    it('reveals by keyboard while the related item stays selected', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
      screen.getByRole('button', { name: GHOST_NAME }).focus();

      await user.keyboard('{Enter}');

      expect(screen.getByRole('button', { name: /^t\.2: Issue 2$/ })).toBePressed();
    });

    it('hides the revealed item again at the next filter-bar change', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      await user.click(screen.getByRole('button', { name: /^To do/ }));

      expect(screen.queryByRole('button', { name: /^t\.2: Issue 2$/ })).not.toBeInTheDocument();
    });

    it('ends a running review when the ghost is activated', async () => {
      const user = userEvent.setup();
      renderChart([...items, buildItem({ number: 5 })], {}, scores);
      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
      await user.click(screen.getByRole('button', { name: /^Review unscored/ }));
      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
      expect(screen.getByRole('button', { name: 'End review' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      expect(screen.queryByRole('button', { name: 'End review' })).not.toBeInTheDocument();
    });
  });
});

// region | Helpers
/** Returns each drawn edge's ends as `from>to` by issue number; edges are decorative SVG. */
function listEdgeEnds(): string[] {
  const group = screen.getByRole('group', { name: 'Items by urgency and impact' });
  return Array.from(group.querySelectorAll<SVGGElement>('.tr-edge'), ({ dataset }) =>
    (dataset['ends'] ?? '').replaceAll(`${REPO}#`, ''),
  );
}

function relate(kind: RelationKind, number: number): Relation {
  return {
    kind,
    ref: {
      repo: REPO,
      number,
      title: `Issue ${number}`,
      url: `https://example.test/${number}`,
      state: number === 1 ? 'open' : 'closed',
    },
  };
}
// endregion | Helpers
