import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

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
});

// region | Helpers
function buildItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'number'>): WorkItem {
  const repo = overrides.repo ?? REPO;
  return {
    repo,
    title: `Issue ${overrides.number}`,
    url: `https://github.com/${repo}/issues/${overrides.number}`,
    state: 'open',
    labels: ['feature'],
    relations: [],
    ...overrides,
  };
}

function getPane(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Item detail' });
}

function renderChart(items: WorkItem[], abbreviations: Record<string, string> = {}) {
  return render(<Chart abbreviations={abbreviations} items={items} />);
}
// endregion | Helpers
