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
  labels: ['feature'],
  relations: [],
};
const ITEM_KEY = 'williamthorsen/top-right#12';
const AT = '2026-11-08T10:00:00.000Z';

describe(DetailPane, () => {
  it('reports a chosen score with the item key and the changed field only', async () => {
    const user = userEvent.setup();
    const { onScoresChange } = renderPane();

    await user.click(within(getGroup('Impact')).getByRole('radio', { name: '4' }));
    await user.click(within(getGroup('Effort')).getByRole('radio', { name: '8' }));

    expect(onScoresChange.mock.calls).toStrictEqual([
      [ITEM_KEY, { impact: 4 }],
      [ITEM_KEY, { effort: 8 }],
    ]);
  });

  it('gives each control one tab stop, and moves and chooses with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onScoresChange } = renderPane({ scores: { urgency: { value: 3, by: 'author', at: AT } } });
    const urgency = getGroup('Urgency');
    const three = within(urgency).getByRole('radio', { name: '3' });

    expect(
      within(urgency)
        .getAllByRole('radio')
        .filter((radio) => radio.tabIndex === 0),
    ).toStrictEqual([three]);
    three.focus();
    await user.keyboard('{ArrowRight}');

    expect(onScoresChange).toHaveBeenCalledWith(ITEM_KEY, { urgency: 4 });
    expect(within(urgency).getByRole('radio', { name: '4' })).toHaveFocus();
  });

  it('shows the provenance of each score, and Unscored for an absent one', () => {
    renderPane({ scores: { urgency: { value: 2, by: 'agent', at: AT }, effort: { value: 3, by: 'author', at: AT } } });

    const pane = screen.getByRole('region', { name: 'Scores' });
    expect(pane).toHaveTextContent(/Agent · /);
    expect(pane).toHaveTextContent(/3 points · Author · /);
    expect(pane).toHaveTextContent('Unscored');
  });

  it('reads an unsized effort as drawn at the floor, without a provenance line', () => {
    renderPane();

    // An exact match fails if the line goes on to a provenance.
    expect(screen.getByText('Unsized, drawn at the floor')).toBeInTheDocument();
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
  const onStatusChange = vi.fn<DetailPaneProps['onStatusChange']>();
  render(
    <DetailPane
      abbreviations={{}}
      blockedKeys={new Set()}
      item={ITEM}
      mode="selected"
      onClose={() => {}}
      onScoresChange={onScoresChange}
      onStatusChange={onStatusChange}
      override={undefined}
      scores={undefined}
      workTypeMapping={DEFAULT_WORK_TYPE_MAPPING}
      {...overrides}
    />,
  );
  return { onScoresChange, onStatusChange };
}
// endregion | Helpers
