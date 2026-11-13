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

    it('reads an unset progress once it is cleared after a drag', () => {
      const { rerenderPane } = renderPane();
      const range = screen.getByRole('slider', { name: 'Progress' });

      fireEvent.input(range, { target: { value: '5' } });
      fireEvent.change(range, { target: { value: '5' } });
      rerenderPane({ scores: { progress: { score: 0.05, by: 'author', at: AT } } });
      rerenderPane({ scores: {} });

      expect(within(screen.getByRole('region', { name: 'Scores' })).getByRole('status')).toHaveTextContent('–');
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

  describe('the Labels list', () => {
    const labelled: WorkItem = {
      ...ITEM,
      labels: ['feature', 'bug', 'urgency:medium', 'urgency:low', 'value:must-have', 'effort:3', 'help wanted'],
    };

    it('leaves out the labels that supply the displayed scores and the type, and keeps the outranked ones', () => {
      renderPane({
        item: labelled,
        scores: {
          urgency: { score: 'medium', by: 'label', label: 'urgency:medium' },
          value: { score: 'must-have', by: 'label', label: 'value:must-have' },
          effort: { score: 3, by: 'label', label: 'effort:3' },
        },
      });

      expect(getLabelChips()).toStrictEqual(['bug', 'urgency:low', 'help wanted']);
    });

    it('keeps a score label that a stored score outranks', () => {
      renderPane({
        item: { ...ITEM, labels: ['urgency:medium'] },
        scores: { urgency: { score: 'high', by: 'author', at: AT } },
      });

      expect(getLabelChips()).toStrictEqual(['urgency:medium']);
    });

    it('reads None when every label is left out', () => {
      renderPane({ item: { ...ITEM, labels: ['feature'] } });

      expect(screen.queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    });

    describe('with the status label', () => {
      const inProgress: WorkItem = {
        ...ITEM,
        labels: ['feature', 'Status:In-Progress'],
        sourceStatus: 'in-progress',
        sourceStatusLabel: 'Status:In-Progress',
      };
      const toDo: StatusOverride = { status: 'to-do', sourceState: 'open', at: AT };

      it('leaves it out while the source reads In progress', () => {
        renderPane({ item: inProgress });

        expect(screen.queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument();
      });

      it('keeps it while an override shows To do', () => {
        renderPane({ item: inProgress, override: toDo });

        expect(getLabelChips()).toStrictEqual(['Status:In-Progress']);
      });

      it('keeps it once the source reads To do, although the item still names it', () => {
        renderPane({ item: { ...inProgress, sourceStatus: 'to-do' } });

        expect(getLabelChips()).toStrictEqual(['Status:In-Progress']);
      });
    });
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

/** Returns the text of each chip in the Labels list, in order. */
function getLabelChips(): string[] {
  return within(screen.getByRole('list', { name: 'Labels' }))
    .getAllByRole('listitem')
    .map((chip) => chip.textContent);
}

function renderPane(overrides: Partial<DetailPaneProps> = {}) {
  const onScoresChange = vi.fn<DetailPaneProps['onScoresChange']>();
  const onScoresClear = vi.fn<NonNullable<DetailPaneProps['onScoresClear']>>();
  const onStatusChange = vi.fn<DetailPaneProps['onStatusChange']>();
  const onKeep = vi.fn<(itemKey: string) => void>();
  const buildPane = (props: Partial<DetailPaneProps>) => (
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
      {...props}
    />
  );
  const { rerender } = render(buildPane(overrides));
  function rerenderPane(props: Partial<DetailPaneProps>): void {
    rerender(buildPane({ ...overrides, ...props }));
  }
  return { onKeep, onScoresChange, onScoresClear, onStatusChange, rerenderPane };
}
// endregion | Helpers
