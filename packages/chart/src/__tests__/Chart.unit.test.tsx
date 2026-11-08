import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  applyScoreWrite,
  type ItemScores,
  keepItemScores,
  type Relation,
  type RelationKind,
  type Scores,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { CELL_PADDING, CELL_SIZE, GUTTER_ROW_PITCH } from '../layout.ts';

const REPO = 'williamthorsen/top-right';

describe(Chart, () => {
  it('lists each item by its abbreviation and number, defaulting to the first letter', () => {
    renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: 'williamthorsen/codeassembly' })], {
      [REPO]: 'tr',
    });

    expect(screen.getByRole('button', { name: /^tr\.1:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^c\.2:/ })).toBeInTheDocument();
  });

  it('when a circle is hovered, previews it in the pane, and clears the preview on leave', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1, title: 'First issue' })]);

    await user.hover(screen.getByRole('button', { name: /^t\.1:/ }));
    expect(getPane()).toHaveTextContent('Preview');
    expect(getPane()).toHaveTextContent('First issue');

    await user.unhover(screen.getByRole('button', { name: /^t\.1:/ }));
    expect(getPane()).toHaveTextContent('No item selected');
  });

  it('when a circle is selected, pins it in the pane until Escape', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1, title: 'First issue' })]);
    const button = screen.getByRole('button', { name: /^t\.1:/ });

    await user.click(button);
    await user.unhover(button);
    expect(button).toBePressed();
    expect(getPane()).toHaveTextContent('First issue');

    await user.keyboard('{Escape}');
    expect(button).not.toBePressed();
  });

  it('when Close is pressed, clears the selection', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 })]);
    const button = screen.getByRole('button', { name: /^t\.1:/ });

    await user.click(button);
    await user.unhover(button);
    await user.click(within(getPane()).getByRole('button', { name: 'Close' }));

    expect(button).not.toBePressed();
    expect(getPane()).toHaveTextContent('No item selected');
  });

  it('lists relations under their kind, with closed and blocked tags', async () => {
    const user = userEvent.setup();
    const blocker = buildItem({ number: 2, title: 'Blocker' });
    const blocked = buildItem({
      number: 3,
      title: 'Blocked',
      relations: [{ kind: 'blocked-by', ref: { ...blocker, title: 'Blocker' } }],
    });
    const parent = buildItem({
      number: 1,
      relations: [
        { kind: 'sub-issue', ref: { ...blocked } },
        {
          kind: 'sub-issue',
          ref: { repo: REPO, number: 9, title: 'Done', url: 'https://example.test/9', state: 'closed' },
        },
      ],
    });
    renderChart([parent, blocker, blocked]);

    await user.click(screen.getByRole('button', { name: /^t\.1:/ }));

    const subIssues = within(getPane()).getByRole('region', { name: 'Sub-issues' });
    expect(within(subIssues).getByRole('link', { name: /t\.3 Blocked blocked/ })).toBeInTheDocument();
    expect(within(subIssues).getByRole('link', { name: /t\.9 Done closed/ })).toBeInTheDocument();
  });

  it('when the unscored items do not fit the corner cell, lets its list scroll', () => {
    const rowsThatFit = Math.floor((CELL_SIZE - 2 * CELL_PADDING) / GUTTER_ROW_PITCH);
    const items = Array.from({ length: rowsThatFit + 1 }, (_, index) => buildItem({ number: index + 1 }));

    renderChart(items);

    expect(screen.getByRole('list', { name: 'Unscored items' })).toHaveAttribute('data-overflow', 'true');
  });

  describe('with scores', () => {
    const at = '2026-11-08T00:00:00.000Z';
    const author = 'author' as const;

    it('moves an item with urgency and impact out of the gutter and into its cell', () => {
      const scored = buildItem({ number: 1 });
      const unscored = buildItem({ number: 2 });

      renderChart(
        [scored, unscored],
        {},
        {
          [`${REPO}#1`]: { urgency: { value: 4, by: author, at }, impact: { value: 5, by: author, at } },
        },
      );

      expect(screen.getByRole('button', { name: /^t\.1:/ })).toHaveAttribute('data-status', 'to-do');
      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).queryByRole('button', { name: /^t\.1:/ })).not.toBeInTheDocument();
      expect(within(gutter).getByRole('button', { name: /^t\.2:/ })).toBeInTheDocument();
    });

    it('keeps an item with only one of urgency and impact in the gutter', () => {
      renderChart([buildItem({ number: 1 })], {}, { [`${REPO}#1`]: { urgency: { value: 3, by: author, at } } });

      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).getByRole('button', { name: /^t\.1:/ })).toBeInTheDocument();
    });

    it('draws an in-progress item with a pie and a to-do item without one', () => {
      const placed: ItemScores = { urgency: { value: 2, by: author, at }, impact: { value: 2, by: author, at } };
      const inProgress: StatusOverride = { status: 'in-progress', sourceState: 'open', at };

      renderChart(
        [buildItem({ number: 1 }), buildItem({ number: 2 })],
        {},
        { [`${REPO}#1`]: placed, [`${REPO}#2`]: placed },
        { [`${REPO}#1`]: inProgress },
      );

      const first = screen.getByRole('button', { name: /^t\.1:/ });
      const second = screen.getByRole('button', { name: /^t\.2:/ });
      expect(first).toHaveAttribute('data-status', 'in-progress');
      // eslint-disable-next-line testing-library/no-node-access -- the pie is decorative SVG, which has no role to query.
      expect(first.querySelector('.tr-node-pie')).not.toBeNull();
      expect(second).toHaveAttribute('data-status', 'to-do');
      // eslint-disable-next-line testing-library/no-node-access -- the pie is decorative SVG, which has no role to query.
      expect(second.querySelector('.tr-node-pie')).toBeNull();
    });

    it('selects a scored circle by click and by Enter', async () => {
      const user = userEvent.setup();
      renderChart(
        [buildItem({ number: 1 }), buildItem({ number: 2 })],
        {},
        {
          [`${REPO}#1`]: { urgency: { value: 1, by: author, at }, impact: { value: 1, by: author, at } },
          [`${REPO}#2`]: { urgency: { value: 1, by: author, at }, impact: { value: 1, by: author, at } },
        },
      );
      const first = screen.getByRole('button', { name: /^t\.1:/ });
      const second = screen.getByRole('button', { name: /^t\.2:/ });

      await user.click(first);
      expect(first).toBePressed();

      second.focus();
      await user.keyboard('{Enter}');
      expect(second).toBePressed();
      expect(first).not.toBePressed();
    });
  });

  describe('with agent scores', () => {
    const at = '2026-11-08T00:00:00.000Z';
    const MOVED: ItemScores = {
      urgency: { value: 4, by: 'agent', at, previous: 2 },
      impact: { value: 5, by: 'agent', at, previous: 3 },
    };
    const FROM_GUTTER: ItemScores = { urgency: { value: 2, by: 'agent', at }, impact: { value: 2, by: 'agent', at } };
    const AUTHOR_HELD: ItemScores = { urgency: { value: 5, by: 'author', at }, impact: { value: 5, by: 'author', at } };

    it('wears a halo on an agent-scored circle and gutter item until the author keeps it', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {
        [`${REPO}#1`]: MOVED,
        [`${REPO}#2`]: { urgency: { value: 3, by: 'agent', at } },
      });
      const circle = screen.getByRole('button', { name: /^t\.1:/ });
      const gutter = screen.getByRole('list', { name: 'Unscored items' });

      expect(hasHalo(circle)).toBe(true);
      expect(hasHalo(within(gutter).getByRole('button', { name: /^t\.2:/ }))).toBe(true);

      await user.click(circle);
      await user.click(screen.getByRole('button', { name: 'Keep' }));

      expect(hasHalo(screen.getByRole('button', { name: /^t\.1:/ }))).toBe(false);
    });

    it('shows a trail only while the circle is hovered or selected, or during the Agent-scored review', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {
        [`${REPO}#1`]: MOVED,
        [`${REPO}#2`]: FROM_GUTTER,
      });

      expect(countTrails()).toBe(0);
      await user.hover(screen.getByRole('button', { name: /^t\.1:/ }));
      expect(countTrails()).toBe(1);
      await user.unhover(screen.getByRole('button', { name: /^t\.1:/ }));
      expect(countTrails()).toBe(0);

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));
      // The item that the agent moved out of the gutter has no previous cell, so only one trail draws.
      expect(countTrails()).toBe(1);
    });

    it('reviews the agent-scored items top-right first, fading the rest, and keeps them with Enter', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })], {
        [`${REPO}#1`]: FROM_GUTTER,
        [`${REPO}#2`]: MOVED,
        [`${REPO}#3`]: AUTHOR_HELD,
      });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));

      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Agent-scored · 1 of 2');
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();
      expect(screen.getByRole('button', { name: /^t\.3:/ })).toHaveAttribute('data-faded', 'true');
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toHaveAttribute('data-faded', 'false');

      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBePressed();
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Agent-scored · 1 of 1');

      await user.keyboard('{Enter}');
      expect(screen.queryByRole('button', { name: /Agent-scored/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Review agent scores (0)' })).toBeDisabled();
      expect(within(getPane()).getByText('Next pick')).toBeInTheDocument();
    });

    it('scrolls each item that the review moves to into view', async () => {
      const user = userEvent.setup();
      using scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {
        [`${REPO}#1`]: FROM_GUTTER,
        [`${REPO}#2`]: MOVED,
      });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));
      await user.click(screen.getByRole('button', { name: 'Skip' }));

      expect(scrollIntoView.mock.contexts).toEqual([
        screen.getByRole('button', { name: /^t\.2:/ }),
        screen.getByRole('button', { name: /^t\.1:/ }),
      ]);
    });

    it('skips without keeping, and ends the review by End review or Escape before Escape clears the selection', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {
        [`${REPO}#1`]: FROM_GUTTER,
        [`${REPO}#2`]: MOVED,
      });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));
      await user.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBePressed();
      await user.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();
      expect(hasHalo(screen.getByRole('button', { name: /^t\.2:/ }))).toBe(true);

      await user.click(screen.getByRole('button', { name: 'End review' }));
      expect(screen.getByRole('button', { name: 'Review agent scores (2)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();

      await user.click(screen.getByRole('button', { name: 'Review agent scores (2)' }));
      await user.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: 'Review agent scores (2)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: /^t\.2:/ })).not.toBePressed();
    });

    it('keeps a corrected item selected during the Agent-scored review, and Enter moves on to the next', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })], {
        [`${REPO}#1`]: FROM_GUTTER,
        [`${REPO}#2`]: MOVED,
        [`${REPO}#3`]: { urgency: { value: 1, by: 'agent', at }, impact: { value: 1, by: 'agent', at } },
      });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (3)' }));
      await user.click(within(getGroup('Urgency')).getByRole('radio', { name: '3' }));
      await user.click(within(getGroup('Impact')).getByRole('radio', { name: '2' }));

      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();
      expect(within(getGroup('Impact')).getByRole('radio', { name: '2' })).toBeChecked();
      expect(hasHalo(screen.getByRole('button', { name: /^t\.2:/ }))).toBe(false);
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Agent-scored · – of 2');

      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBePressed();
    });

    it('moves an Unscored review on once the selected item has both urgency and impact', async () => {
      const user = userEvent.setup();
      renderReview([buildItem({ number: 1 }), buildItem({ number: 2 })], {});

      await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · 1 of 2');
      await user.click(
        within(within(getPane()).getByRole('radiogroup', { name: 'Urgency' })).getByRole('radio', { name: '3' }),
      );
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · 1 of 2');
      await user.click(
        within(within(getPane()).getByRole('radiogroup', { name: 'Impact' })).getByRole('radio', { name: '4' }),
      );

      // The placed item stays selected for a moment, so that the author sees it move, then the review moves on.
      expect(within(getPane()).getByText('Issue 1')).toBeInTheDocument();
      expect(await within(getPane()).findByText('Issue 2')).toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · 1 of 1');
    });
  });

  describe('with edges', () => {
    // t.1 blocks t.2, which blocks t.3; t.4 is a sub-issue of t.2; t.5 stands apart.
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
      [`${REPO}#4`]: place(4, 4),
      [`${REPO}#5`]: place(5, 5),
    };

    it('draws no edge at rest', () => {
      renderChart(chainItems, {}, chainScores);

      expect(listEdges()).toStrictEqual([]);
    });

    it('when a circle is hovered, draws its own edges, and fades every unrelated circle', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      await user.hover(screen.getByRole('button', { name: /^t\.2:/ }));

      expect(listEdges()).toStrictEqual(['blocker:1>2:direct', 'blocker:2>3:direct', 'sub-issue:4>2:direct']);
      expect(screen.getByRole('button', { name: /^t\.5:/ })).toHaveAttribute('data-faded', 'true');
      expect(screen.getByRole('button', { name: /^t\.4:/ })).toHaveAttribute('data-faded', 'false');
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toHaveAttribute('data-faded', 'false');
    });

    it('when a circle is selected, draws its blocker chain at reduced weight and keeps a faded circle selectable', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      await user.click(screen.getByRole('button', { name: /^t\.1:/ }));
      await user.unhover(screen.getByRole('button', { name: /^t\.1:/ }));

      expect(listEdges()).toStrictEqual(['blocker:2>3:chain', 'blocker:1>2:direct']);
      expect(screen.getByRole('button', { name: /^t\.4:/ })).toHaveAttribute('data-faded', 'true');

      await user.click(screen.getByRole('button', { name: /^t\.4:/ }));
      expect(screen.getByRole('button', { name: /^t\.4:/ })).toBePressed();
    });

    it('with All edges pressed, draws every edge once, faintly when nothing is focused', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      const toggle = screen.getByRole('button', { name: 'All edges' });

      await user.click(toggle);

      expect(toggle).toBePressed();
      expect(listEdges()).toStrictEqual(['blocker:1>2:faint', 'blocker:2>3:faint', 'sub-issue:4>2:faint']);
    });

    it('during a review, fades by the queue rather than by focus', async () => {
      const user = userEvent.setup();
      const agent = { value: 3, by: 'agent' as const, at: '2026-11-08T00:00:00.000Z' };
      renderReview(chainItems, { ...chainScores, [`${REPO}#5`]: { urgency: agent, impact: agent } });

      await user.click(screen.getByRole('button', { name: 'Review agent scores (1)' }));

      expect(screen.getByRole('button', { name: /^t\.5:/ })).toHaveAttribute('data-faded', 'false');
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toHaveAttribute('data-faded', 'true');
    });

    it('draws a blocker cycle', async () => {
      const user = userEvent.setup();
      const cycle = [
        buildItem({ number: 1, relations: [relate('blocking', 2)] }),
        buildItem({ number: 2, relations: [relate('blocking', 1)] }),
      ];
      renderChart(cycle, {}, { [`${REPO}#1`]: place(1, 1), [`${REPO}#2`]: place(3, 3) });

      await user.hover(screen.getByRole('button', { name: /^t\.1:/ }));

      expect(listEdges()).toStrictEqual(['blocker:1>2:direct', 'blocker:2>1:direct']);
    });

    it('rings a blocked item, in its cell and in the gutter, and names it blocked', () => {
      const inGutter = buildItem({ number: 6, relations: [relate('blocked-by', 1)] });
      renderChart([...chainItems, inGutter], {}, chainScores);

      const circle = screen.getByRole('button', { name: /^t\.2:.*, blocked$/ });
      expect(hasMark(circle, 'tr-node-blocked')).toBe(true);
      expect(hasMark(screen.getByRole('button', { name: /^t\.1:/ }), 'tr-node-blocked')).toBe(false);
      const row = within(screen.getByRole('list', { name: 'Unscored items' })).getByRole('button', {
        name: /^t\.6:.*, blocked$/,
      });
      expect(hasMark(row, 'tr-circle-blocked')).toBe(true);
    });

    it('while nothing is selected, rings the next pick and shows it in the pane', async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);

      const pick = screen.getByRole('button', { name: /^t\.5:.*, next pick$/ });
      expect(hasMark(pick, 'tr-node-pick')).toBe(true);
      expect(getPane()).toHaveTextContent('Next pick');
      expect(getPane()).toHaveTextContent('Issue 5');
      expect(within(getPane()).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^t\.4:/ }));
      expect(getPane()).toHaveTextContent('Selected');
      expect(getPane()).toHaveTextContent('Issue 4');
      expect(hasMark(pick, 'tr-node-pick')).toBe(true);
    });

    it("when a relation row in the pane is hovered, rings that row's circle", async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      await user.click(screen.getByRole('button', { name: /^t\.2:/ }));

      const row = within(getPane()).getByRole('link', { name: /t\.3 Issue 3/ });
      await user.hover(row);
      expect(screen.getByRole('button', { name: /^t\.3:/ })).toHaveAttribute('data-highlighted', 'true');

      await user.unhover(row);
      expect(screen.getByRole('button', { name: /^t\.3:/ })).toHaveAttribute('data-highlighted', 'false');
    });

    it("ends a relation row's highlight when the pane leaves its item under the pointer", async () => {
      const user = userEvent.setup();
      renderChart(chainItems, {}, chainScores);
      await user.click(screen.getByRole('button', { name: /^t\.2:/ }));
      await user.hover(within(getPane()).getByRole('link', { name: /t\.3 Issue 3/ }));

      await user.keyboard('{Escape}');

      expect(screen.getByRole('button', { name: /^t\.3:/ })).toHaveAttribute('data-highlighted', 'false');
    });
  });
});

// region | Helpers
function buildItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'number'>): WorkItem {
  const repo = overrides.repo ?? REPO;
  return {
    repo,
    title: `Issue ${overrides.number}`,
    url: `https://github.com/${repo}/issues/${overrides.number}`,
    state: 'open',
    createdAt: '2026-11-01T09:00:00Z',
    labels: ['feature'],
    relations: [],
    ...overrides,
  };
}

/** Returns the number of trails on the chart; a trail is decorative SVG, which has no role to query. */
function countTrails(): number {
  return screen.getByRole('group', { name: 'Items by urgency and impact' }).querySelectorAll('.tr-trail').length;
}

/** Returns whether the item wears the agent's halo, which is decorative SVG without a role to query. */
function hasHalo(element: HTMLElement): boolean {
  return element.querySelector('.tr-node-halo, .tr-circle-halo') !== null;
}

/** Returns whether the item wears the mark of `className`, which is decorative SVG without a role to query. */
function hasMark(element: HTMLElement, className: string): boolean {
  return element.querySelector(`.${className}`) !== null;
}

function getGroup(name: string): HTMLElement {
  return within(getPane()).getByRole('radiogroup', { name });
}

function getPane(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Item detail' });
}

/** Returns each drawn edge as `kind:from>to:weight` by issue number, in draw order; edges are decorative SVG. */
function listEdges(): string[] {
  const group = screen.getByRole('group', { name: 'Items by urgency and impact' });
  return Array.from(group.querySelectorAll<SVGGElement>('.tr-edge'), ({ dataset }) => {
    const ends = (dataset['ends'] ?? '').replaceAll(`${REPO}#`, '');
    return `${dataset['kind']}:${ends}:${dataset['weight']}`;
  });
}

/** Returns author scores that place an item in the cell at urgency `u` and impact `i`. */
function place(u: number, i: number): ItemScores {
  const at = '2026-11-08T00:00:00.000Z';
  return { urgency: { value: u, by: 'author', at }, impact: { value: i, by: 'author', at } };
}

function relate(kind: RelationKind, number: number): Relation {
  return {
    kind,
    ref: { repo: REPO, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state: 'open' },
  };
}

function renderChart(
  items: WorkItem[],
  abbreviations: Record<string, string> = {},
  scores: Record<string, ItemScores> = {},
  overrides: Record<string, StatusOverride> = {},
) {
  return render(<Chart abbreviations={abbreviations} items={items} overrides={overrides} scores={scores} />);
}

/** Renders the chart with a host that applies the author's writes and Keep to its scores, as the page does. */
function renderReview(items: WorkItem[], initialScores: Record<string, ItemScores>) {
  function ReviewHost(): ReactElement {
    const [scores, setScores] = useState(initialScores);
    const at = '2026-11-09T00:00:00.000Z';
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onKeep={(itemKey) => setScores((current) => ({ ...current, [itemKey]: keepItemScores(current[itemKey], at) }))}
        onScoresChange={(itemKey, changed: Scores) =>
          setScores((current) => ({ ...current, [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', at) }))
        }
        scores={scores}
      />
    );
  }
  return render(<ReviewHost />);
}
// endregion | Helpers
