import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Relation, RelationKind, WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';
import { chooseRepos, getReposButton } from '../test-utils/repo-menu.ts';

const CA = 'williamthorsen/codeassembly';
const ABBREVIATIONS = { [REPO]: 'T', [CA]: 'C' };
// T.1 is blocked by T.2, which is done; blocks T.3; and is the parent of C.4, in another repository, and of T.9, which
// the chart is not given. T.5 is done and unrelated; T.6 is unscored, so that a review can start.
const items: WorkItem[] = [
  buildItem({
    number: 1,
    relations: [relate('blocked-by', 2), relate('blocking', 3), relate('sub-issue', 4, CA), relate('sub-issue', 9)],
  }),
  buildItem({ number: 2, state: 'closed', relations: [relate('blocking', 1)] }),
  buildItem({ number: 3, relations: [relate('blocked-by', 1)] }),
  buildItem({ number: 4, repo: CA, relations: [relate('parent', 1)] }),
  buildItem({ number: 5, state: 'closed' }),
  buildItem({ number: 6 }),
];
const scores = {
  [`${REPO}#1`]: place(3, 3),
  [`${REPO}#2`]: place(4, 4),
  [`${REPO}#3`]: place(2, 2),
  [`${CA}#4`]: place(1, 1),
  [`${REPO}#5`]: place(4, 4),
};

describe(Chart, () => {
  describe('when a relation row whose item the chart was given is activated', () => {
    it('selects the item as a history entry', async () => {
      const user = userEvent.setup();
      const { onChange } = renderHosted();
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      await user.click(getRow(/^T\.3 Issue 3/));

      expect(onChange).toHaveBeenLastCalledWith(`${REPO}#3`, { push: true });
      expect(screen.getByRole('button', { name: /^T\.3:/ })).toBePressed();
      expect(within(getPane()).getByRole('heading', { level: 2, name: 'Issue 3' })).toBeInTheDocument();
    });

    it('selects the item by Enter and moves focus to its title in the pane', async () => {
      const user = userEvent.setup();
      renderChart(items, ABBREVIATIONS, scores);
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      getRow(/^T\.3 Issue 3/).focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('button', { name: /^T\.3:/ })).toBePressed();
      expect(within(getPane()).getByRole('heading', { level: 2, name: 'Issue 3' })).toHaveFocus();
    });

    it('reveals a hidden done item alone and leaves Done off', async () => {
      const user = userEvent.setup();
      renderChart(items, ABBREVIATIONS, scores);
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      await user.click(getRow(/^T\.2 Issue 2/));

      expect(screen.getByRole('button', { name: /^T\.2: Issue 2$/ })).toBePressed();
      expect(screen.queryByRole('button', { name: /^T\.5:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Done/ })).not.toBePressed();
    });

    it('reveals an item in a repository that the filter hides alone and leaves the Repos filter as it was', async () => {
      const user = userEvent.setup();
      renderChart(items, ABBREVIATIONS, scores);
      await chooseRepos(user, 'top-right (T)');
      await user.click(screen.getByRole('button', { name: /^1:/ }));

      await user.click(getRow(/^C\.4 Issue 4/));

      expect(screen.getByRole('button', { name: /^(C\.)?4:/ })).toBePressed();
      expect(getReposButton()).toHaveAccessibleName('Repos: top-right');
    });

    it('keeps a running review when the item is shown, and ends it when the row reveals the item', async () => {
      const user = userEvent.setup();
      renderChart(items, ABBREVIATIONS, scores);
      await user.click(screen.getByRole('button', { name: /^Review unscored/ }));
      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      await user.click(getRow(/^T\.3 Issue 3/));
      expect(screen.getByRole('button', { name: 'End review' })).toBeInTheDocument();

      await user.click(getRow(/^T\.1 Issue 1/));
      await user.click(getRow(/^T\.2 Issue 2/));
      expect(screen.queryByRole('button', { name: 'End review' })).not.toBeInTheDocument();
    });
  });

  it('links a relation row whose item the chart was not given to its source in a new tab', async () => {
    const user = userEvent.setup();
    renderChart(items, ABBREVIATIONS, scores);
    await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

    const link = within(getPane()).getByRole('link', { name: /^T\.9 Issue 9.*\(opens in a new tab\)$/ });

    expect(link).toHaveAttribute('href', 'https://example.test/9');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(getPane()).queryByRole('button', { name: /^T\.9/ })).not.toBeInTheDocument();
  });
});

// region | Helpers
/** Returns the pane's relation row, as a button, whose accessible name matches `name`. */
function getRow(name: RegExp): HTMLElement {
  return within(getPane()).getByRole('button', { name });
}

/** Returns a relation of `kind` to an open issue titled after its number. */
function relate(kind: RelationKind, number: number, repo = REPO): Relation {
  return {
    kind,
    ref: { repo, number, title: `Issue ${number}`, url: `https://example.test/${number}`, state: 'open' },
  };
}

/** Renders the chart under a host that holds the selection, and returns the spy that sees each reported change. */
function renderHosted(): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn<(key: string | undefined, options: { push: boolean }) => void>();

  function Host(): ReactElement {
    const [selectedKey, setSelectedKey] = useState<string>();
    return (
      <Chart
        abbreviations={ABBREVIATIONS}
        items={items}
        onSelectedKeyChange={(key, options) => {
          onChange(key, options);
          setSelectedKey(key);
        }}
        overrides={{}}
        scores={scores}
        selectedKey={selectedKey}
      />
    );
  }

  render(<Host />);
  return { onChange };
}
// endregion | Helpers
