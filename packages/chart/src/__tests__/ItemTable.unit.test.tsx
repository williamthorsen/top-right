import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ItemTable } from '../ItemTable.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';

describe(ItemTable, () => {
  it("selects a row's item on a click, marking its circle and showing it in the pane", async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 }), buildItem({ number: 2 })], {}, { [`${REPO}#2`]: place(3, 3) });

    await user.click(getRow('Issue 2'));

    expect(screen.getByRole('button', { name: /^T\.2:/ })).toBePressed();
    expect(getPane()).toHaveTextContent('Issue 2');
  });

  it('marks the row of the circle that is selected on the chart', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 })], {}, { [`${REPO}#1`]: place(3, 3) });
    expect(getRow('Issue 1')).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

    expect(getRow('Issue 1')).toHaveAttribute('aria-current', 'true');
  });

  it('does not select the row when its source link is opened', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 })]);

    await user.click(within(getRow('Issue 1')).getByRole('link'));

    expect(getRow('Issue 1')).not.toHaveAttribute('aria-current');
  });

  it('shows urgency and value by their level names', () => {
    renderChart([buildItem({ number: 1 })], {}, { [`${REPO}#1`]: place(3, 4) });

    const row = screen.getByRole('row', { name: /Issue 1/ });
    expect(within(row).getByRole('cell', { name: 'High' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: 'Must-have' })).toBeInTheDocument();
  });

  it("shows the status that the item's source supplies", () => {
    renderChart([buildItem({ number: 1, sourceStatus: 'in-progress' })]);

    expect(within(getRow('Issue 1')).getByRole('cell', { name: /In progress/ })).toBeInTheDocument();
  });

  it('shows progress as a percentage', () => {
    const at = '2026-11-08T00:00:00.000Z';
    renderChart([buildItem({ number: 1 })], {}, { [`${REPO}#1`]: { progress: { score: 0.35, by: 'author', at } } });

    expect(
      within(screen.getByRole('row', { name: /Issue 1/ })).getByRole('cell', { name: '35 %' }),
    ).toBeInTheDocument();
  });

  it('sorts by a column ascending, then descending, and marks the sorted column', async () => {
    const user = userEvent.setup();
    renderChart(
      [buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })],
      {},
      { [`${REPO}#1`]: place(2, 1), [`${REPO}#3`]: place(4, 1) },
    );
    const header = screen.getByRole('columnheader', { name: /^Urgency/ });

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(listTitles()).toEqual(['Issue 1', 'Issue 3', 'Issue 2']);

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(listTitles()).toEqual(['Issue 3', 'Issue 1', 'Issue 2']);
  });

  it('lists only the items that the filter keeps', async () => {
    const user = userEvent.setup();
    renderChart([buildItem({ number: 1 })]);

    await user.click(screen.getByRole('button', { name: /^To do/ }));

    expect(within(getTable()).getByText('No items match the filter.')).toBeInTheDocument();
  });
});

// region | Helpers
function getRow(title: string): HTMLElement {
  const row = within(getTable())
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByRole('button', { name: title }) !== null);
  if (!row) throw new Error(`No row for ${title}`);
  return row;
}

function getTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Items' });
}

function listTitles(): string[] {
  return within(getTable())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('button').textContent);
}
// endregion | Helpers
