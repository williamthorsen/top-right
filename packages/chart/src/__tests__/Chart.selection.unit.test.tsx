import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ItemScores, StatusOverride, WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, place, REPO } from '../test-utils/chart-fixtures.tsx';
import { getPane } from '../test-utils/chart-queries.ts';
import { getReposButton } from '../test-utils/repo-menu.ts';

const AGENT_AT = '2026-11-08T00:00:00.000Z';

describe(Chart, () => {
  describe('with a host that holds the selection', () => {
    it('reports a circle click as a history entry and shows the item that the host passes back', async () => {
      const user = userEvent.setup();
      const { onChange } = renderHosted([buildItem({ number: 1 })], { [`${REPO}#1`]: place(3, 3) });

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(onChange).toHaveBeenLastCalledWith(`${REPO}#1`, { push: true });
      expect(screen.getByRole('button', { name: /^T\.1:/ })).toBePressed();
    });

    it('reports Close and Escape as history entries', async () => {
      const user = userEvent.setup();
      const { onChange } = renderHosted([buildItem({ number: 1 })], { [`${REPO}#1`]: place(3, 3) }, `${REPO}#1`);

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(onChange).toHaveBeenLastCalledWith(undefined, { push: true });

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      await user.keyboard('{Escape}');
      expect(onChange).toHaveBeenLastCalledWith(undefined, { push: true });
    });

    it('reports a review step in place of the current entry', async () => {
      const user = userEvent.setup();
      const scores = { [`${REPO}#1`]: agentPlace(3, 3), [`${REPO}#2`]: agentPlace(2, 2) };
      const { onChange } = renderHosted([buildItem({ number: 1 }), buildItem({ number: 2 })], scores);

      await user.click(screen.getByRole('button', { name: /^Review agent scores/ }));

      expect(onChange).toHaveBeenLastCalledWith(`${REPO}#1`, { push: false });
    });

    it('clears a selection that a filter change hides, in place of the current entry', async () => {
      const user = userEvent.setup();
      const { onChange } = renderHosted([buildItem({ number: 1 })], { [`${REPO}#1`]: place(3, 3) }, `${REPO}#1`);

      await user.click(screen.getByRole('button', { name: /^To do/ }));

      expect(onChange).toHaveBeenLastCalledWith(undefined, { push: false });
    });

    it('turns the status toggle back on to show an item that the host selects while the filter hides it', async () => {
      const user = userEvent.setup();
      const items = [buildItem({ number: 1 }), buildItem({ number: 2 })];
      const { onChange, select } = renderHosted(items, { [`${REPO}#2`]: place(3, 3) }, undefined, {
        [`${REPO}#2`]: { status: 'in-progress', sourceState: 'open', at: AGENT_AT },
      });
      const toggle = screen.getByRole('button', { name: /^In progress/ });
      await user.click(toggle);
      expect(toggle).not.toBePressed();

      act(() => select(`${REPO}#2`));

      expect(toggle).toBePressed();
      expect(screen.getByRole('button', { name: /^T\.2:/ })).toBePressed();
      expect(getPane()).toHaveTextContent('Issue 2');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('reveals an item that the host selects again after Close, once the filter hides it', async () => {
      const user = userEvent.setup();
      const items = [buildItem({ number: 1 }), buildItem({ number: 2 })];
      const { onChange, select } = renderHosted(items, { [`${REPO}#2`]: place(3, 3) }, `${REPO}#2`, {
        [`${REPO}#2`]: { status: 'in-progress', sourceState: 'open', at: AGENT_AT },
      });
      await user.click(screen.getByRole('button', { name: 'Close' }));
      const toggle = screen.getByRole('button', { name: /^In progress/ });
      await user.click(toggle);
      onChange.mockClear();

      act(() => select(`${REPO}#2`));

      expect(toggle).toBePressed();
      expect(screen.getByRole('button', { name: /^T\.2:/ })).toBePressed();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears a key that names none of the items, in place of the current entry', () => {
      const { onChange } = renderHosted([buildItem({ number: 1 })], {}, `${REPO}#99`);

      expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined, { push: false });
    });

    it('shows an item that the host selects later, as on Back', () => {
      const { onChange, select } = renderHosted([buildItem({ number: 1 }), buildItem({ number: 2 })], {
        [`${REPO}#1`]: place(3, 3),
        [`${REPO}#2`]: place(2, 2),
      });

      act(() => select(`${REPO}#2`));

      expect(screen.getByRole('button', { name: /^T\.2:/ })).toBePressed();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("adds the repo of an item that the host selects outside the default collection to the filter's scope", () => {
      const other = 'williamthorsen/codeassembly';
      const tools = 'williamthorsen/toolbelt';
      const items = [
        buildItem({ number: 1 }),
        buildItem({ number: 2, repo: other }),
        buildItem({ number: 3, repo: tools }),
      ];
      render(
        <Chart
          abbreviations={{ [REPO]: 'tr', [other]: 'ca', [tools]: 'tb' }}
          collections={[{ id: 'c1', name: 'Product', repos: [REPO] }]}
          defaultCollectionId="c1"
          items={items}
          onSelectedKeyChange={() => undefined}
          selectedKey={`${other}#2`}
        />,
      );

      expect(getReposButton()).toHaveAccessibleName('Repos: Product, codeassembly');
      expect(screen.getByRole('button', { name: /^ca\.2:/ })).toBePressed();
      expect(screen.queryByRole('button', { name: /^tb\.3:/ })).not.toBeInTheDocument();
    });
  });
});

// region | Helpers
/** Returns agent scores that place an item in the cell whose urgency rank is `u` and value rank is `v`. */
function agentPlace(u: number, v: number): ItemScores {
  const scores = place(u, v);
  return {
    ...(scores.urgency && { urgency: { ...scores.urgency, by: 'agent', at: AGENT_AT } }),
    ...(scores.value && { value: { ...scores.value, by: 'agent', at: AGENT_AT } }),
  };
}

/** Renders the chart under a host that holds the selection, starting at `initialKey`, and records each change. */
function renderHosted(
  items: WorkItem[],
  scores: Record<string, ItemScores>,
  initialKey?: string,
  overrides: Record<string, StatusOverride> = {},
): { onChange: ReturnType<typeof vi.fn>; select: (key: string | undefined) => void } {
  const onChange = vi.fn<(key: string | undefined, options: { push: boolean }) => void>();
  const handle: { select: (key: string | undefined) => void } = { select: () => undefined };

  function Host(): ReactElement {
    const [selectedKey, setSelectedKey] = useState(initialKey);
    handle.select = setSelectedKey;
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onKeep={() => undefined}
        overrides={overrides}
        onSelectedKeyChange={(key, options) => {
          onChange(key, options);
          setSelectedKey(key);
        }}
        scores={scores}
        selectedKey={selectedKey}
      />
    );
  }

  render(<Host />);
  return { onChange, select: (key) => handle.select(key) };
}
// endregion | Helpers
