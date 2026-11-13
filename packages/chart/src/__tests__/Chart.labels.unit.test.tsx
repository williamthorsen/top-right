import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ItemScores, keepItemScores, type ScoreLabelMapping, type WorkItem } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { sizeCircle } from '../layout.ts';
import { buildItem, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getGroup, getPane } from '../test-utils/chart-queries.ts';

import '@testing-library/jest-dom/vitest';

const AT = '2026-11-08T00:00:00.000Z';

describe(Chart, () => {
  describe('with scores from labels', () => {
    it('places an item by its labels and checks their levels in the pane', async () => {
      renderChart([
        buildItem({ number: 1, labels: ['feature', 'urgency:high', 'value:must-have'] }),
        buildItem({ number: 2 }),
      ]);

      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).queryByRole('button', { name: /^T\.1:/ })).not.toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));
      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
      expect(within(getGroup('Value')).getByRole('radio', { name: 'Must have' })).toBeChecked();
    });

    it('keeps an item that a label places on one axis only in the gutter', () => {
      renderChart([buildItem({ number: 1, labels: ['value:must-have'] })]);

      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).getByRole('button', { name: /^T\.1:/ })).toBeInTheDocument();
    });

    it('ranks a stored score above the label', async () => {
      renderChart(
        [buildItem({ number: 1, labels: ['urgency:high', 'value:must-have'] })],
        {},
        {
          [`${REPO}#1`]: { value: { score: 'nice-to-have', by: 'author', at: AT } },
        },
      );
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(within(getGroup('Value')).getByRole('radio', { name: 'Nice to have' })).toBeChecked();
      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
    });

    it('moves an Unscored review on once the author scores the axis that a label leaves open', async () => {
      const user = userEvent.setup();
      renderChart([buildItem({ number: 1, labels: ['value:must-have'] }), buildItem({ number: 2 })]);

      await user.click(screen.getByRole('button', { name: 'Review unscored (2)' }));
      await user.click(within(getGroup('Urgency')).getByRole('radio', { name: 'High' }));

      expect(await within(getPane()).findByText('Issue 2')).toBeInTheDocument();
    });

    it('offers no Keep for an item that labels alone score', async () => {
      render(
        <Chart
          abbreviations={{}}
          items={[buildItem({ number: 1, labels: ['urgency:high', 'value:must-have'] })]}
          onKeep={vi.fn()}
        />,
      );
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(within(getPane()).getByText('Issue 1')).toBeInTheDocument();
      expect(within(getPane()).queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    });

    it('reads labels through the mapping that the host passes', async () => {
      const mapping: ScoreLabelMapping = {
        urgency: { critical: [], high: ['priority:high'], low: [], medium: [] },
        value: { 'must-have': ['value:must-have'], 'nice-to-have': [], questionable: [], 'should-have': [] },
        effort: { 1: [], 2: [], 3: ['size:m'], 5: [], 8: [], 13: [] },
      };
      render(
        <Chart
          abbreviations={{}}
          items={[buildItem({ number: 1, labels: ['priority:high', 'value:must-have'] })]}
          scoreLabelMapping={mapping}
        />,
      );
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
    });
  });

  describe('with an effort from a label', () => {
    const LABELS = ['urgency:high', 'value:must-have', 'effort:5'];

    it('sizes the circle by the label and checks its effort in the pane', async () => {
      renderChart([buildItem({ number: 1, labels: LABELS })]);
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(readRadius(screen.getByRole('button', { name: /^T\.1:/ }))).toBeCloseTo(sizeCircle(5).r);
      expect(within(getGroup('Effort')).getByRole('radio', { name: '5' })).toBeChecked();
    });

    it('ranks a stored effort above the label', async () => {
      renderChart(
        [buildItem({ number: 1, labels: LABELS })],
        {},
        {
          [`${REPO}#1`]: { effort: { score: 2, by: 'author', at: AT } },
        },
      );
      await userEvent.setup().click(screen.getByRole('button', { name: /^T\.1:/ }));

      expect(readRadius(screen.getByRole('button', { name: /^T\.1:/ }))).toBeCloseTo(sizeCircle(2).r);
      expect(within(getGroup('Effort')).getByRole('radio', { name: '2' })).toBeChecked();
    });

    it('keeps the effort a label effort when the author keeps an agent score', async () => {
      const user = userEvent.setup();
      renderKeepHost([buildItem({ number: 1, labels: ['value:must-have', 'effort:3'] })], {
        [`${REPO}#1`]: { urgency: { score: 'high', by: 'agent', at: AT } },
      });

      await user.click(screen.getByRole('button', { name: /^T\.1:/ }));
      await user.click(within(getPane()).getByRole('button', { name: 'Keep' }));

      expect(within(getPane()).queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
      expect(within(getGroup('Effort')).getByRole('radio', { name: '3' })).toBeChecked();
    });
  });
});

// region | Helpers
function readRadius(circle: HTMLElement): number {
  return Number(circle.querySelector('.tr-node-main')?.getAttribute('r') ?? NaN);
}

function renderKeepHost(items: WorkItem[], initialScores: Record<string, ItemScores>) {
  function KeepHost(): ReactElement {
    const [scores, setScores] = useState(initialScores);
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onKeep={(itemKey) => setScores((current) => ({ ...current, [itemKey]: keepItemScores(current[itemKey], AT) }))}
        scores={scores}
      />
    );
  }
  return render(<KeepHost />);
}
// endregion | Helpers
