import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ItemScores } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { buildItem, place, REPO, renderChart, renderReview } from '../test-utils/chart-fixtures.tsx';
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
});

// region | Helpers
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
