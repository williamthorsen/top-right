import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Relation, RelationKind, WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';
import { chooseRepos } from '../test-utils/repo-menu.ts';

// T.1 is open and blocked by T.2, which is closed; T.3 is closed and unrelated; T.4 is closed, related, and unscored.
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
const GHOST_NAME = 'T.2: Issue 2, done, hidden';
const CA = 'williamthorsen/codeassembly';

describe(Chart, () => {
  describe('with a hidden done item at the end of an edge', () => {
    it('draws no ghost at rest', () => {
      renderChart(items, {}, scores);

      expect(screen.queryByRole('button', { name: GHOST_NAME })).not.toBeInTheDocument();
    });

    it('draws a ghost with the edge to it while the related item is hovered, without moving the circle', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      const circle = screen.getByRole('button', { name: /^T\.1:/ });
      const position = circle.getAttribute('transform');

      await user.hover(circle);

      expect(screen.getByRole('button', { name: GHOST_NAME })).toBeInTheDocument();
      expect(listEdgeEnds()).toStrictEqual(['2>1']);
      expect(circle).toHaveAttribute('transform', position);
    });

    it('draws the ghost of an unsized item as a done circle with a dotted work-type border and no other mark', async () => {
      const user = userEvent.setup();
      const bugItems = items.map((item) => (item.number === 2 ? { ...item, labels: ['bug'] } : item));
      renderChart(bugItems, {}, scores);

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      const ghost = screen.getByRole('button', { name: GHOST_NAME });
      expect(ghost).toHaveAttribute('data-status', 'done');
      expect(ghost).toHaveAttribute('data-work-type', 'bug');
      expect(ghost).toHaveAttribute('data-sized', 'false');
      expect(listMarks(ghost)).toStrictEqual([
        'tr-node-hit',
        'tr-node-main',
        'tr-node-border',
        'tr-node-selected',
        'tr-node-focus',
      ]);
    });

    it('draws the ghost of a sized item with a solid border', async () => {
      const user = userEvent.setup();
      const at = '2026-11-08T00:00:00.000Z';
      renderChart(items, {}, { ...scores, [`${REPO}#2`]: { ...place(4, 4), effort: { score: 8, by: 'author', at } } });

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(screen.getByRole('button', { name: GHOST_NAME })).toHaveAttribute('data-sized', 'true');
    });

    it('draws no ghost for an unscored done item or an unrelated one', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(screen.queryByRole('button', { name: /^T\.4:/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^T\.3:/ })).not.toBeInTheDocument();
    });

    it('when the ghost is clicked, selects and reveals that item alone and leaves Done off', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      expect(screen.getByRole('button', { name: /^T\.2: Issue 2$/ })).toBePressed();
      expect(screen.queryByRole('button', { name: /^T\.3:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Done/ })).not.toBePressed();
    });

    it('is reached by Tab from the selected circle, past the other circles, and reveals by Enter', async () => {
      const user = userEvent.setup();
      // T.5 is a visible circle that follows T.1 in the matrix; focusing it would move the edges to it.
      renderChart([...items, buildItem({ number: 5 })], {}, { ...scores, [`${REPO}#5`]: place(2, 2) });
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      await user.tab();

      expect(screen.getByRole('button', { name: GHOST_NAME })).toHaveFocus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('button', { name: /^T\.2: Issue 2$/ })).toBePressed();
    });

    it('draws no ghost for an edge from an item in a gutter, which draws no edge', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, { [`${REPO}#2`]: place(4, 4) });

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(screen.queryByRole('button', { name: GHOST_NAME })).not.toBeInTheDocument();
    });

    it('hides the revealed item again at the next filter-bar change', async () => {
      const user = userEvent.setup();
      renderChart(items, {}, scores);
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      await user.click(screen.getByRole('button', { name: /^To do/ }));

      expect(screen.queryByRole('button', { name: /^T\.2: Issue 2$/ })).not.toBeInTheDocument();
    });

    it('ends a running review when the ghost is activated', async () => {
      const user = userEvent.setup();
      renderChart([...items, buildItem({ number: 5 })], {}, scores);
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      await user.click(screen.getByRole('button', { name: /^Review unscored/ }));
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      expect(screen.getByRole('button', { name: 'End review' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: GHOST_NAME }));

      expect(screen.queryByRole('button', { name: 'End review' })).not.toBeInTheDocument();
    });
  });

  describe('with related items in a repository that the filter hides', () => {
    // T.1 is blocked by C.2, which is open and not loaded, and is the parent of C.3, which is closed, loaded, and scored.
    const crossItems: WorkItem[] = [
      buildItem({ number: 1, relations: [relate('blocked-by', 2, CA, 'open'), relate('sub-issue', 3, CA)] }),
      buildItem({ number: 3, repo: CA, state: 'closed', relations: [relate('parent', 1)] }),
    ];
    const crossScores = { [`${REPO}#1`]: place(3, 3), [`${CA}#3`]: place(4, 4) };
    const ABBREVIATIONS = { [REPO]: 'T', [CA]: 'C' };

    it('draws no ghost or edge for the loaded done item, and lists both relations in the pane', async () => {
      const user = userEvent.setup();
      renderChart(crossItems, ABBREVIATIONS, crossScores);
      await chooseRepos(user, 'top-right (T)');

      await user.click(screen.getByRole('button', { name: /^1:/ }));

      expect(screen.queryByRole('button', { name: /^(C\.)?3:/ })).not.toBeInTheDocument();
      expect(listEdgeEnds()).toStrictEqual([]);
      expect(within(getPane()).getByRole('link', { name: /C\.2 Issue 2/ })).toBeInTheDocument();
      expect(within(getPane()).getByRole('button', { name: /C\.3 Issue 3/ })).toBeInTheDocument();
    });

    it('fades nothing while the focused item relates only to items off the board', async () => {
      const user = userEvent.setup();
      renderChart([...crossItems, buildItem({ number: 5 })], ABBREVIATIONS, {
        ...crossScores,
        [`${REPO}#5`]: place(2, 2),
      });
      await chooseRepos(user, 'top-right (T)');

      await user.click(screen.getByRole('button', { name: /^1:/ }));

      expect(screen.getByRole('button', { name: /^5:/ })).not.toHaveAttribute('data-fade');
    });

    it('rings the item that the unloaded open item blocks', async () => {
      const user = userEvent.setup();
      renderChart(crossItems, ABBREVIATIONS, crossScores);

      await chooseRepos(user, 'top-right (T)');

      expect(screen.getByRole('button', { name: /^1:.*, blocked$/ })).toBeInTheDocument();
    });
  });
});

// region | Helpers
/** Returns each drawn edge's ends as `from>to` by issue number; edges are decorative SVG. */
function listEdgeEnds(): string[] {
  const group = screen.getByRole('group', { name: 'Items by urgency and value' });
  return Array.from(group.querySelectorAll<SVGGElement>('.tr-edge'), ({ dataset }) =>
    (dataset['ends'] ?? '').replaceAll(`${REPO}#`, ''),
  );
}

/** Returns the classes of the circles that draw an item; the circles are decorative SVG. */
function listMarks(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('circle'), (circle) => circle.getAttribute('class') ?? '');
}

function relate(
  kind: RelationKind,
  number: number,
  repo = REPO,
  state: 'closed' | 'open' = number === 1 ? 'open' : 'closed',
): Relation {
  return {
    kind,
    ref: { repo, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state },
  };
}
// endregion | Helpers
