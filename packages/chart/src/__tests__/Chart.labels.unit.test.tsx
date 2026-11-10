import { render, screen, within } from '@testing-library/react';
import type { ScoreLabelMapping } from '@top-right/model';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';
import { getGroup, getPane } from '../test-utils/chart-queries.ts';

import '@testing-library/jest-dom/vitest';

const AT = '2026-11-08T00:00:00.000Z';

describe(Chart, () => {
  describe('with scores from labels', () => {
    it('places an item by its labels and names each label in the pane', () => {
      renderChart([
        buildItem({ number: 1, labels: ['feature', 'urgency:high', 'value:must-have'] }),
        buildItem({ number: 2 }),
      ]);

      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).queryByRole('button', { name: /^t\.1:/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^t\.1:/ })).toBeInTheDocument();
      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
      expect(within(getGroup('Value')).getByRole('radio', { name: 'Must-have' })).toBeChecked();
      expect(within(getPane()).getByText('Label · urgency:high')).toBeInTheDocument();
      expect(within(getPane()).getByText('Label · value:must-have')).toBeInTheDocument();
    });

    it('keeps an item that a label places on one axis only in the gutter', () => {
      renderChart([buildItem({ number: 1, labels: ['value:must-have'] })]);

      const gutter = screen.getByRole('list', { name: 'Unscored items' });
      expect(within(gutter).getByRole('button', { name: /^t\.1:/ })).toBeInTheDocument();
    });

    it('ranks a stored score above the label', () => {
      renderChart(
        [buildItem({ number: 1, labels: ['urgency:high', 'value:must-have'] })],
        {},
        {
          [`${REPO}#1`]: { value: { score: 'nice-to-have', by: 'author', at: AT } },
        },
      );

      expect(within(getGroup('Value')).getByRole('radio', { name: 'Nice-to-have' })).toBeChecked();
      expect(within(getPane()).queryByText('Label · value:must-have')).not.toBeInTheDocument();
      expect(within(getPane()).getByText('Label · urgency:high')).toBeInTheDocument();
    });

    it('offers no Keep for an item that labels alone score', () => {
      render(
        <Chart
          abbreviations={{}}
          items={[buildItem({ number: 1, labels: ['urgency:high', 'value:must-have'] })]}
          onKeep={vi.fn()}
        />,
      );

      expect(within(getPane()).queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    });

    it('reads labels through the mapping that the host passes', () => {
      const mapping: ScoreLabelMapping = {
        urgency: { critical: [], high: ['priority:high'], low: [], medium: [] },
        value: { 'must-have': ['value:must-have'], 'nice-to-have': [], questionable: [], 'should-have': [] },
      };
      render(
        <Chart
          abbreviations={{}}
          items={[buildItem({ number: 1, labels: ['priority:high', 'value:must-have'] })]}
          scoreLabelMapping={mapping}
        />,
      );

      expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
      expect(within(getPane()).getByText('Label · priority:high')).toBeInTheDocument();
    });
  });
});
