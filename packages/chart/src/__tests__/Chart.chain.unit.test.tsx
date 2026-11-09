import { screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { ItemScores, Relation, RelationKind } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';

const CA = 'williamthorsen/codeassembly';
const ABBREVIATIONS = { [REPO]: 't', [CA]: 'c' };

/** A chain #1 → #2 → #3, with #3 in a gutter, a shorter chain #4 → #5, and #6 unrelated. */
const ITEMS = [
  buildItem({ number: 1, relations: [relate('blocking', 2)] }),
  buildItem({ number: 2, relations: [relate('blocked-by', 1), relate('blocking', 3)] }),
  buildItem({ number: 3, relations: [relate('blocked-by', 2)] }),
  buildItem({ number: 4, repo: CA, relations: [relate('blocking', 5, CA)] }),
  buildItem({ number: 5, repo: CA, relations: [relate('blocked-by', 4, CA)] }),
  buildItem({ number: 6 }),
];
const SCORES: Record<string, ItemScores> = {
  [`${REPO}#1`]: place(4, 4),
  [`${REPO}#2`]: place(3, 3),
  [`${CA}#4`]: place(2, 2),
  [`${CA}#5`]: place(1, 1),
  [`${REPO}#6`]: place(4, 1),
};

describe('Chart longest chain', () => {
  it('fades every item outside the chain, in the cells and the gutters, and draws its edges at full weight', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, ABBREVIATIONS, SCORES);

    await showChain(user);

    expect(getCircle('t.1')).toHaveAttribute('data-faded', 'false');
    expect(getCircle('t.2')).toHaveAttribute('data-faded', 'false');
    expect(getGutterRow('t.3')).toHaveAttribute('data-faded', 'false');
    expect(getCircle('c.4')).toHaveAttribute('data-faded', 'true');
    expect(getCircle('t.6')).toHaveAttribute('data-faded', 'true');
    expect(listEdges()).toStrictEqual([`blocker:${REPO}#1>${REPO}#2:direct`]);
  });

  it('keeps a faded circle selectable, never fades the selected one, and keeps its neighbours faded', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, ABBREVIATIONS, SCORES);
    await showChain(user);

    await user.click(getCircle('c.4'));

    expect(getCircle('c.4')).toBePressed();
    expect(getCircle('c.4')).toHaveAttribute('data-faded', 'false');
    expect(getCircle('c.5')).toHaveAttribute('data-faded', 'true');
    expect(listEdges()).toContain(`blocker:${CA}#4>${CA}#5:direct`);
  });

  it('shows the chain’s length in the strip, whose End button turns the view off', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, ABBREVIATIONS, SCORES);
    await showChain(user);
    const status = screen.getByRole('toolbar', { name: 'Longest chain' });
    expect(status).toHaveTextContent('Longest chain · 3 items');

    await user.click(within(status).getByRole('button', { name: 'End chain view' }));

    expect(screen.queryByRole('toolbar', { name: 'Longest chain' })).not.toBeInTheDocument();
    expect(getCircle('t.6')).toHaveAttribute('data-faded', 'false');
    expect(listEdges()).toStrictEqual([]);
  });

  it('ends the chain view when a review starts, and ends a review when the chain view is turned on', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, ABBREVIATIONS, SCORES);
    await showChain(user);

    await user.click(screen.getByRole('button', { name: /^Review unscored/ }));

    expect(screen.queryByRole('toolbar', { name: 'Longest chain' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End review' })).toBeInTheDocument();

    await showChain(user);

    expect(screen.queryByRole('button', { name: 'End review' })).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Longest chain' })).toBeInTheDocument();
  });

  it('recomputes the chain on a filter change, and turns the view off when no chain remains', async () => {
    const user = userEvent.setup();
    renderChart(ITEMS, ABBREVIATIONS, SCORES);
    await showChain(user);
    const repo = screen.getByRole('combobox', { name: 'Repo' });

    await user.selectOptions(repo, 'codeassembly (c)');

    expect(screen.getByRole('toolbar', { name: 'Longest chain' })).toHaveTextContent('Longest chain · 2 items');
    expect(getCircle('4')).toHaveAttribute('data-faded', 'false');

    await user.click(screen.getByRole('button', { name: /^To do/ }));

    expect(screen.queryByRole('toolbar', { name: 'Longest chain' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^To do/ }));
    expect(screen.queryByRole('toolbar', { name: 'Longest chain' })).not.toBeInTheDocument();
  });

  it('disables the chain item when the shown items contain no chain', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 }), buildItem({ number: 2 })]);

    await user.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

// region | Helpers
function getCircle(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${label.replace('.', String.raw`\.`)}:`) });
}

/** Returns the gutter row of the item, which carries the fade rather than its button. */
function getGutterRow(label: string): HTMLElement | null {
  const list = screen.getByRole('list', { name: 'Unscored items' });
  return within(list)
    .getByRole('button', { name: new RegExp(`^${label.replace('.', String.raw`\.`)}:`) })
    .closest('li');
}

/** Returns each drawn edge as `kind:from>to:weight`, in draw order; edges are decorative SVG. */
function listEdges(): string[] {
  const group = screen.getByRole('group', { name: 'Items by urgency and impact' });
  return Array.from(
    group.querySelectorAll<SVGGElement>('.tr-edge'),
    ({ dataset }) => `${dataset['kind']}:${dataset['ends']}:${dataset['weight']}`,
  );
}

function relate(kind: RelationKind, number: number, repo = REPO): Relation {
  return {
    kind,
    ref: { repo, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state: 'open' },
  };
}

async function showChain(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'More' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' }));
}
// endregion | Helpers
