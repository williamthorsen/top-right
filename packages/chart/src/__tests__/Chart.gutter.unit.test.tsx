import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP } from '../Grid.tsx';
import { CELL_SIZE, GRID_SIZE } from '../layout.ts';
import { buildItem, renderChart } from '../test-utils/chart-fixtures.tsx';

describe(Chart, () => {
  it('renders every gutter list as HTML outside the SVG, which WebKit draws and hit-tests at every scale', () => {
    renderChart([buildItem({ number: 1 }), buildItem({ number: 2 })]);

    const lists = screen.getAllByRole('list', { name: 'Unscored items' });
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      // eslint-disable-next-line testing-library/no-node-access -- the SVG ancestor that the list must lack has no role to query.
      expect(list.closest('svg')).toBeNull();
    }
  });

  it('places the corner gutter cell at the matrix margins, in chart units', () => {
    renderChart([buildItem({ number: 1 })]);

    // eslint-disable-next-line testing-library/no-node-access -- the positioned cell around the list has no role to query.
    const cell = screen.getByRole('list', { name: 'Unscored items' }).parentElement;
    expect(cell).toHaveStyle({ left: `${MARGIN_LEFT}px`, top: `${(GRID_SIZE - 1) * CELL_SIZE + MARGIN_TOP}px` });
  });

  it('scales the layer of gutter cells with the chart', async () => {
    renderChart([buildItem({ number: 1 })]);

    await userEvent.setup().keyboard('+');

    // eslint-disable-next-line testing-library/no-node-access -- the layer around the cells has no role to query.
    const layer = screen.getByRole('list', { name: 'Unscored items' }).parentElement?.parentElement;
    expect(layer).toHaveStyle({ transform: 'scale(1.25)' });
  });
});
