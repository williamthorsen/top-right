import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Collection, StatusOverride, WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getGroup, getPane } from '../test-utils/chart-queries.ts';
import { chooseRepos, getReposButton } from '../test-utils/repo-menu.ts';

const CA = 'williamthorsen/codeassembly';
const TOOLS = 'williamthorsen/toolbelt';
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

      await chooseRepos(user, 'top-right (tr)');

      expect(screen.getByRole('button', { name: /^1:/ })).toBeInTheDocument();
      expect(within(getGutter()).getByRole('button', { name: /^2:/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(ca\.)?3:/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(ca\.)?4:/ })).not.toBeInTheDocument();
    });

    it('offers All repos, then each repo by name and abbreviation, sorted by name, without a Collections group', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 })], ABBREVIATIONS);
      expect(getReposButton()).toHaveAccessibleName('Repos: All repos');

      await user.click(getReposButton());

      const menu = screen.getByRole('menu', { name: 'Repos' });
      expect(
        within(menu)
          .getAllByRole('menuitemcheckbox')
          .map((item) => item.textContent),
      ).toEqual(['✓All repos', 'codeassembly (ca)', 'top-right (tr)']);
      expect(within(menu).queryByRole('group', { name: 'Collections' })).not.toBeInTheDocument();
      expect(within(menu).getByRole('group', { name: 'Repositories' })).toBeInTheDocument();
    });

    it('offers two repos that share a name and an abbreviation as separate items', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderChart([buildItem({ number: 1 })], { 'alice/tools': 'T', 'bob/tools': 'T' });

      await user.click(getReposButton());

      expect(screen.getAllByRole('menuitemcheckbox', { name: 'tools (T)' })).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
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
      expect(screen.getByRole('button', { name: /^T\.1:/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^T\.2:/ })).not.toBeInTheDocument();
    });

    it('hides closed items until Done is turned on, and counts them under Done', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, state: 'closed' })]);
      const toggle = screen.getByRole('button', { name: /^Done/ });
      expect(toggle).not.toBePressed();
      expect(toggle).toHaveAccessibleName('Done 1');
      expect(screen.queryByRole('button', { name: /^T\.2:/ })).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toBePressed();
      expect(screen.getByRole('button', { name: /^T\.2:/ })).toBeInTheDocument();
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

      await chooseRepos(user, 'codeassembly (ca)');

      expect(screen.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do 1');
      expect(screen.getByRole('button', { name: /^In progress/ })).toHaveAccessibleName('In progress 0');
    });

    it('picks among the filtered items only', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS, {
        [`${REPO}#1`]: place(4, 4),
        [`${CA}#2`]: place(1, 1),
      });
      expect(screen.getByRole('button', { name: /^tr\.1:.*, next pick$/ })).toBeInTheDocument();

      await chooseRepos(user, 'codeassembly (ca)');

      expect(screen.getByRole('button', { name: /^2:.*, next pick$/ })).toBeInTheDocument();
    });

    it('counts the review queues over the filtered items only', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS);
      expect(screen.getByRole('button', { name: 'Review unscored (2)' })).toBeInTheDocument();

      await chooseRepos(user, 'top-right (tr)');

      expect(screen.getByRole('button', { name: 'Review unscored (1)' })).toBeInTheDocument();
    });

    it('ends a running review on a filter change, and clears a selection that the filter hides', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1 }), buildItem({ number: 2, repo: CA })], ABBREVIATIONS);
      await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
      expect(screen.getByRole('button', { name: /^ca\.2:/ })).toBePressed();

      await chooseRepos(user, 'top-right (tr)');

      expect(screen.getByRole('button', { name: 'Review unscored (1)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^1:/ })).not.toBePressed();
      expect(getPane()).toHaveTextContent('No item selected');
    });

    it('when a status change in the pane hides the selected item, clears it and keeps the review running', async () => {
      const user = userEvent.setup();
      renderBoard([buildItem({ number: 1 }), buildItem({ number: 2 }), buildItem({ number: 3 })]);
      await user.click(screen.getByRole('button', { name: /^In progress/ }));
      await user.click(screen.getByRole('button', { name: 'Review unscored (3)' }));
      expect(screen.getByRole('button', { name: /^T\.1:/ })).toBePressed();

      await user.click(within(getGroup('Status')).getByRole('radio', { name: 'In progress' }));

      expect(screen.queryByRole('button', { name: /^T\.1:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: 'Review' })).toHaveTextContent('Unscored · – of 2');
      await user.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.getByRole('button', { name: /^T\.2:/ })).toBePressed();
    });

    it('keeps listing a relation to a filtered-out item in the pane, by its abbreviated id', async () => {
      const user = userEvent.setup();
      const blocker = buildItem({ number: 2, repo: CA });
      renderChart(
        [buildItem({ number: 1, relations: [{ kind: 'blocked-by', ref: blocker }] }), blocker],
        ABBREVIATIONS,
      );

      await chooseRepos(user, 'top-right (tr)');
      await user.click(screen.getByRole('button', { name: /^1:/ }));

      expect(within(getPane()).getByRole('link', { name: /ca\.2 Issue 2/ })).toBeInTheDocument();
      expect(within(getPane()).getByText('tr.1')).toBeInTheDocument();
    });
  });

  describe('with collections', () => {
    const ABBREVIATIONS = { [REPO]: 'tr', [CA]: 'ca', [TOOLS]: 'tb' };
    const COLLECTIONS: Collection[] = [
      { id: 'c1', name: 'Product', repos: [REPO, CA] },
      { id: 'c2', name: 'Solo', repos: [TOOLS] },
    ];
    const ITEMS = [buildItem({ number: 1 }), buildItem({ number: 2, repo: CA }), buildItem({ number: 3, repo: TOOLS })];

    it('offers the collections in their order in a group of their own, before the repositories', async () => {
      const user = userEvent.setup();
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS);

      await user.click(getReposButton());

      const collections = screen.getByRole('group', { name: 'Collections' });
      expect(
        within(collections)
          .getAllByRole('menuitemcheckbox')
          .map((item) => item.textContent),
      ).toEqual(['Product', 'Solo']);
      expect(collections.compareDocumentPosition(screen.getByRole('group', { name: 'Repositories' }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('shows the union of the selected collections and repositories, naming them in the label', async () => {
      const user = userEvent.setup();
      renderWithCollections(
        [...ITEMS, buildItem({ number: 4, repo: 'williamthorsen/other' })],
        { ...ABBREVIATIONS, 'williamthorsen/other': 'o' },
        COLLECTIONS,
      );

      await chooseRepos(user, 'Product', 'toolbelt (tb)');

      expect(getReposButton()).toHaveAccessibleName('Repos: Product, toolbelt');
      expect(getReposButton()).toHaveTextContent('Product, toolbelt');
      expect(getGutterLabels()).toEqual(['tr.1', 'ca.2', 'tb.3']);
      expect(screen.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do 3');
    });

    it('stays open while entries are toggled, and checks each selected entry', async () => {
      const user = userEvent.setup();
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS);
      await user.click(getReposButton());

      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Product' }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'toolbelt (tb)' }));

      expect(screen.getByRole('menu', { name: 'Repos' })).toBeVisible();
      expect(screen.getByRole('menuitemcheckbox', { name: 'All repos' })).not.toBeChecked();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Product' })).toBeChecked();
      expect(screen.getByRole('menuitemcheckbox', { name: 'toolbelt (tb)' })).toBeChecked();
    });

    it('clears the selection on All repos', async () => {
      const user = userEvent.setup();
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS, 'c1');

      await chooseRepos(user, 'All repos');

      expect(getReposButton()).toHaveAccessibleName('Repos: All repos');
      expect(getGutterLabels()).toEqual(['tr.1', 'ca.2', 'tb.3']);
    });

    it('starts at the default collection, which the label names', () => {
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS, 'c1');

      expect(getReposButton()).toHaveAccessibleName('Repos: Product');
      expect(getGutterLabels()).toEqual(['tr.1', 'ca.2']);
    });

    it('starts at every repo when the default names an unknown collection', () => {
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS, 'gone');

      expect(getReposButton()).toHaveAccessibleName('Repos: All repos');
      expect(getGutterLabels()).toEqual(['tr.1', 'ca.2', 'tb.3']);
    });

    it('labels items by number alone when a collection of one repo is shown', () => {
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS, 'c2');

      expect(getGutterLabels()).toEqual(['3']);
    });

    it('labels items by their abbreviated ids when a collection of two repos is shown', () => {
      renderWithCollections(ITEMS, ABBREVIATIONS, COLLECTIONS, 'c1');

      expect(getGutterLabels()).toEqual(['tr.1', 'ca.2']);
    });
  });
});

// region | Helpers
function getGutter(): HTMLElement {
  return screen.getByRole('list', { name: 'Unscored items' });
}

/** Returns the id label of each item in the gutter, read from the start of its button's accessible name. */
function getGutterLabels(): string[] {
  return within(getGutter())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label')?.split(':', 1)[0] ?? '');
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

/** Renders the chart with the user's collections and default collection, as the host passes them. */
function renderWithCollections(
  items: WorkItem[],
  abbreviations: Record<string, string>,
  collections: Collection[],
  defaultCollectionId?: string,
) {
  return render(
    <Chart
      abbreviations={abbreviations}
      collections={collections}
      defaultCollectionId={defaultCollectionId}
      items={items}
    />,
  );
}
// endregion | Helpers
