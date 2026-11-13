import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_WORK_TYPE_MAPPING, type ItemScores, type StatusOverride, type WorkItem } from '@top-right/model';
import { describe, expect, it, vi } from 'vitest';

import { DetailPane, type DetailPaneProps } from '../DetailPane.tsx';

const ITEM: WorkItem = {
  repo: 'williamthorsen/top-right',
  number: 12,
  title: 'Score items',
  url: 'https://github.com/williamthorsen/top-right/issues/12',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: ['feature'],
  relations: [],
};
const ITEM_KEY = 'williamthorsen/top-right#12';
const AT = '2026-11-08T10:00:00.000Z';

describe(DetailPane, () => {
  describe('with agent scores', () => {
    const moved: ItemScores = {
      urgency: { score: 'critical', by: 'agent', at: AT, previous: 'medium' },
      value: { score: 'must-have', by: 'author', at: AT },
    };

    it('offers Keep, which keeps the item, and names the cell that the agent moved it from', async () => {
      const user = userEvent.setup();
      const { onKeep } = renderPane({ scores: moved });

      expect(screen.getByText('Moved by the agent from Medium urgency, Must have value')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Keep' }));

      expect(onKeep).toHaveBeenCalledWith(ITEM_KEY);
    });

    it('shows the Enter hint on Keep only during a review', () => {
      renderPane({ scores: moved, isReviewing: true });

      expect(screen.getByRole('button', { name: 'Keep' })).toHaveTextContent('KeepEnter');
    });

    it('offers no Keep for an item that the author holds', () => {
      renderPane({ scores: { urgency: { score: 'critical', by: 'author', at: AT } } });

      expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    });
  });

  it('reports a chosen score with the item key and the changed field only', async () => {
    const user = userEvent.setup();
    const { onScoresChange } = renderPane();

    await user.click(within(getGroup('Value')).getByRole('radio', { name: 'Should have' }));
    await user.click(within(getGroup('Effort')).getByRole('radio', { name: '8' }));

    expect(onScoresChange.mock.calls).toStrictEqual([
      [ITEM_KEY, { value: 'should-have' }],
      [ITEM_KEY, { effort: 8 }],
    ]);
  });

  it('gives each control one tab stop, and moves and chooses with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onScoresChange } = renderPane({ scores: { urgency: { score: 'high', by: 'author', at: AT } } });
    const urgency = getGroup('Urgency');
    const high = within(urgency).getByRole('radio', { name: 'High' });

    expect(
      within(urgency)
        .getAllByRole('radio')
        .filter((radio) => radio.tabIndex === 0),
    ).toStrictEqual([high]);
    high.focus();
    await user.keyboard('{ArrowRight}');

    expect(onScoresChange).toHaveBeenCalledWith(ITEM_KEY, { urgency: 'critical' });
    expect(within(urgency).getByRole('radio', { name: 'Critical' })).toHaveFocus();
  });

  it("captions an agent's score, and no score that the author or a label holds", () => {
    renderPane({
      scores: {
        urgency: { score: 'medium', by: 'agent', at: AT },
        value: { score: 'must-have', by: 'author', at: AT },
        effort: { score: 3, by: 'author', at: AT },
        progress: { score: 0.5, by: 'author', at: AT },
      },
    });

    const pane = screen.getByRole('region', { name: 'Scores' });
    expect(pane).toHaveTextContent(/Agent · /);
    expect(pane).not.toHaveTextContent(/Author|points|Unscored/);
  });

  it('reads an unsized effort as drawn at the floor', () => {
    renderPane();

    // An exact match fails if the line goes on to say more.
    expect(screen.getByText('Unsized, drawn at the floor')).toBeInTheDocument();
  });

  it("names each value level by its full name, which contains the segment's short name", () => {
    renderPane();

    for (const name of ['Questionable', 'Nice to have', 'Should have', 'Must have']) {
      expect(within(getGroup('Value')).getByRole('radio', { name })).toBeInTheDocument();
    }
  });

  describe('clearing a score', () => {
    const scored: ItemScores = {
      urgency: { score: 'high', by: 'author', at: AT },
      progress: { score: 0.4, by: 'author', at: AT },
    };

    it('offers a clear button only for a row that has a score', () => {
      renderPane({ scores: scored });

      expect(screen.getByRole('button', { name: 'Clear urgency' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Clear progress' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Clear value', hidden: true })).toHaveAttribute('data-hidden', 'true');
    });

    it('clears the one field by pointer, and moves the focus to the row control', async () => {
      const user = userEvent.setup();
      const { onScoresClear } = renderPane({ scores: scored });

      await user.click(screen.getByRole('button', { name: 'Clear urgency' }));

      expect(onScoresClear).toHaveBeenCalledWith(ITEM_KEY, ['urgency']);
      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toHaveFocus();
    });

    it('clears progress by keyboard and moves the focus to the range', async () => {
      const user = userEvent.setup();
      const { onScoresClear } = renderPane({ scores: scored });
      screen.getByRole('button', { name: 'Clear progress' }).focus();

      await user.keyboard('{Enter}');

      expect(onScoresClear).toHaveBeenCalledWith(ITEM_KEY, ['progress']);
      expect(screen.getByRole('slider', { name: 'Progress' })).toHaveFocus();
    });

    it('offers no clear button when the host passes no clear handler', () => {
      renderPane({ scores: scored, onScoresClear: undefined });

      expect(screen.queryByRole('button', { name: /^Clear / })).not.toBeInTheDocument();
    });
  });

  it('sets In progress and To do, and never Done', async () => {
    const user = userEvent.setup();
    const override: StatusOverride = { status: 'in-progress', sourceState: 'open', at: AT };
    const { onStatusChange } = renderPane({ override });
    const status = getGroup('Status');

    expect(within(status).getByRole('radio', { name: 'In progress' })).toBeChecked();
    await user.click(within(status).getByRole('radio', { name: 'Done' }));
    await user.click(within(status).getByRole('radio', { name: 'To do' }));

    expect(onStatusChange.mock.calls).toStrictEqual([[ITEM_KEY, 'to-do']]);
    expect(within(status).getByRole('radio', { name: 'Done' })).toHaveAttribute('aria-disabled', 'true');
  });

  it("shows the status that the item's source supplies when no override applies", () => {
    renderPane({ item: { ...ITEM, sourceStatus: 'in-progress' } });

    expect(within(getGroup('Status')).getByRole('radio', { name: 'In progress' })).toBeChecked();
  });

  it("shows a closed item's status as Done, read-only", async () => {
    const user = userEvent.setup();
    const { onStatusChange } = renderPane({ item: { ...ITEM, state: 'closed' } });
    const status = getGroup('Status');

    expect(within(status).getByRole('radio', { name: 'Done' })).toBeChecked();
    await user.click(within(status).getByRole('radio', { name: 'In progress' }));

    expect(onStatusChange).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Scores' })).toHaveTextContent('Closed at the source');
  });

  it('commits progress as a fraction when the range reports a change', () => {
    const { onScoresChange } = renderPane();
    const range = screen.getByRole('slider', { name: 'Progress' });

    fireEvent.input(range, { target: { value: '40' } });
    expect(onScoresChange).not.toHaveBeenCalled();
    fireEvent.change(range, { target: { value: '40' } });

    expect(onScoresChange).toHaveBeenCalledWith(ITEM_KEY, { progress: 0.4 });
  });
});

// region | Helpers
function getGroup(name: string): HTMLElement {
  return screen.getByRole('radiogroup', { name });
}

function renderPane(overrides: Partial<DetailPaneProps> & { scores?: ItemScores } = {}) {
  const onScoresChange = vi.fn<DetailPaneProps['onScoresChange']>();
  const onScoresClear = vi.fn<NonNullable<DetailPaneProps['onScoresClear']>>();
  const onStatusChange = vi.fn<DetailPaneProps['onStatusChange']>();
  const onKeep = vi.fn<(itemKey: string) => void>();
  render(
    <DetailPane
      abbreviations={{}}
      blockedKeys={new Set()}
      isReviewing={false}
      item={ITEM}
      mode="selected"
      onClose={() => {}}
      onKeep={onKeep}
      onScoresChange={onScoresChange}
      onScoresClear={onScoresClear}
      onStatusChange={onStatusChange}
      override={undefined}
      scores={undefined}
      workTypeMapping={DEFAULT_WORK_TYPE_MAPPING}
      {...overrides}
    />,
  );
  return { onKeep, onScoresChange, onScoresClear, onStatusChange };
}
// endregion | Helpers
