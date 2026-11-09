import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { StatusOverride, WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getGroup, getPane } from '../test-utils/chart-queries.ts';

const CA = 'williamthorsen/codeassembly';
const IN_PROGRESS: StatusOverride = { status: 'in-progress', sourceState: 'open', at: '2026-11-08T00:00:00.000Z' };

describe(Chart, () => {
  describe('with a filter', () => {
    const ABBREVIATIONS = { [REPO]: 'tr', [CA]: 'ca' };

    it("removes the other repos' items from the cells and the gutters, and labels the rest by number alone", async () => {
      const user = userEvent.setup();
      renderChart(
        [
          buildItem({ number: 1 }),
          buildItem({ number: 2 }),
          buildItem({ number: 3, repo: CA }),
          buildItem({ number: 4, repo: CA }),
        ],
        ABBREVIATIONS,
        { [`${REPO}#1`]: place(3, 3), [`${CA}#3`]: place(4, 4) },
      );
      expect(screen.getByRole('button', { name: /^ca\.3:/ })).toBeInTheDocument();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'top-right (tr)');

      expect(screen.getByRole('button', { name: /^1:/ })).toBeInTheDocument();
      expect(within(getGutter()).getByRole('button', { name: /^2:/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(ca\.)?3:/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(ca\.)?4:/ })).not.toBeInTheDocument();
    });

    it('offers each repo by name and abbreviation, sorted by name, after All repos', () => {
      renderChart([buildItem({ number: 1 })], ABBREVIATIONS);

      const options = within(screen.getByRole('combobox', { name: 'Repo' })).getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All repos', 'codeassembly (ca)', 'top-right (tr)']);
    });

    it('when In progress is turned off, removes the items in progress and keeps the counts', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2 })], {}, {}, { [`${REPO}#2`]: IN_PROGRESS });
      const toggle = screen.getByRole('button', { name: /^In progress/ });
      expect(toggle).toBePressed();

      await user.click(toggle);

      expect(toggle).not.toBePressed();
      expect(toggle).toHaveAccessibleName('In progress 1');
      expect(screen.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do 1');
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^t\.2:/ })).not.toBeInTheDocument();
    });

    it('hides closed items until Done is turned on, and counts them under Done', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, state: 'closed' })]);
      const toggle = screen.getByRole('button', { name: /^Done/ });
      expect(toggle).not.toBePressed();
      expect(toggle).toHaveAccessibleName('Done 1');
      expect(screen.queryByRole('button', { name: /^t\.2:/ })).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toBePressed();
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBeInTheDocument();
    });

    it('counts each status within the repo filter', async () => {
      const user = userEvent.setup();
      renderChart(
        [buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3, repo: CA })],
        ABBREVIATIONS,
        {},
        { [`${REPO}#2`]: IN_PROGRESS },
      );
      expect(screen.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do 2');

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'codeassembly (ca)');

      expect(screen.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do 1');
      expect(screen.getByRole('button', { name: /^In progress/ })).toHaveAccessibleName('In progress 0');
    });

    it('picks among the filtered items only', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS, {
        [`${REPO}#1`]: place(5, 5),
        [`${CA}#2`]: place(1, 1),
      });
      expect(screen.getByRole('button', { name: /^tr\.1:.*, next pick$/ })).toBeInTheDocument();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'codeassembly (ca)');

      expect(screen.getByRole('button', { name: /^2:.*, next pick$/ })).toBeInTheDocument();
    });

    it('counts the review queues over the filtered items only', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS);
      expect(screen.getByRole('button', { name: 'Review unscored (2)' })).toBeInTheDocument();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'top-right (tr)');

      expect(screen.getByRole('button', { name: 'Review unscored (1)' })).toBeInTheDocument();
    });

    it('ends a running review on a filter change, and clears a selection that the filter hides', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS);
      await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
      expect(screen.getByRole('button', { name: /^ca\.2:/ })).toBePressed();

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'top-right (tr)');

      expect(screen.getByRole('button', { name: 'Review unscored (1)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^1:/ })).not.toBePressed();
      expect(getPane()).toHaveTextContent('No item selected');
    });

    it('when a status change in the pane hides the selected item, clears it and keeps the review running', async () => {
      const user = userEvent.setup();
      renderBoard([buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })]);
      await user.click(screen.getByRole('button', { name: /^In progress/ }));
      await user.click(screen.getByRole('button', { name: 'Review unscored (3)' }));
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBePressed();

      await user.click(within(getGroup('Status')).getByRole('radio', { name: 'In progress' }));

      expect(screen.queryByRole('button', { name: /^t\.1:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · – of 2');
      await user.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.getByRole('button', { name: /^t\.2:/ })).toBePressed();
    });

    it('keeps listing a relation to a filtered-out item in the pane, by its abbreviated id', async () => {
      const user = userEvent.setup();
      const blocker = buildItem({ number: 2, repo: CA });
      renderChart(
        [buildItem({ number: 1, relations: [{ kind: 'blocked-by', ref: blocker }] }), blocker],
        ABBREVIATIONS,
      );

      await user.selectOptions(screen.getByRole('combobox', { name: 'Repo' }), 'top-right (tr)');
      await user.click(screen.getByRole('button', { name: /^1:/ }));

      expect(within(getPane()).getByRole('link', { name: /ca\.2 Issue 2/ })).toBeInTheDocument();
      expect(within(getPane()).getByText('tr.1')).toBeInTheDocument();
    });
  });
});

// region | Helpers
function getGutter(): HTMLElement {
  return screen.getByRole('list', { name: 'Unscored items' });
}

/** Renders the chart with a host that applies the author's status changes to its overrides, as the page does. */
function renderBoard(items: WorkItem[]) {
  function BoardHost(): ReactElement {
    const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onStatusChange={(itemKey, status) =>
          setOverrides((current) => ({ ...current, [itemKey]: { status, sourceState: 'open', at: IN_PROGRESS.at } }))
        }
        overrides={overrides}
      />
    );
  }
  return render(<BoardHost />);
}
// endregion | Helpers
