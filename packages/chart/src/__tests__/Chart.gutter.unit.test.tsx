import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { clearScoreFields, type ItemScores, type ScoreField } from '@top-right/model';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP } from '../Grid.tsx';
import { GRID_SIZE, MIN_CELL_SIZE } from '../layout.ts';
import { buildItem, place, renderChart, REPO } from '../test-utils/chart-fixtures.tsx';

const CORNER_STYLE = { left: `${MARGIN_LEFT}px`, top: `${(GRID_SIZE - 1) * MIN_CELL_SIZE + MARGIN_TOP}px` };

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
    expect(cell).toHaveStyle(CORNER_STYLE);
  });

  it('moves an item whose urgency the author clears to the unscored column, and to the corner once value goes too', async () => {
    const user = userEvent.setup();
    render(<ClearingHost />);
    await user.click(screen.getByRole('button', { name: /^T\.1:/ }));

    await user.click(screen.getByRole('button', { name: 'Clear urgency' }));

    const list = screen.getByRole('list', { name: 'Unscored items' });
    expect(within(list).getByText('T.1')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access -- the positioned cell around the list has no role to query.
    expect(list.parentElement).not.toHaveStyle(CORNER_STYLE);

    await user.click(screen.getByRole('button', { name: 'Clear value' }));

    // eslint-disable-next-line testing-library/no-node-access -- the positioned cell around the list has no role to query.
    expect(screen.getByRole('list', { name: 'Unscored items' }).parentElement).toHaveStyle(CORNER_STYLE);
  });

  it('scales the layer of gutter cells with the chart', async () => {
    renderChart([buildItem({ number: 1 })]);

    await userEvent.setup().keyboard('+');

    // eslint-disable-next-line testing-library/no-node-access -- the layer around the cells has no role to query.
    const layer = screen.getByRole('list', { name: 'Unscored items' }).parentElement?.parentElement;
    expect(layer).toHaveStyle({ transform: 'scale(1.25)' });
  });
});

// region | Helpers
/** Renders a chart whose host clears scores as the author asks, starting from one item placed in the matrix. */
function ClearingHost(): ReactElement {
  const key = `${REPO}#1`;
  const [scores, setScores] = useState<Record<string, ItemScores>>({ [key]: place(3, 3) });
  function clearScores(itemKey: string, fields: readonly ScoreField[]): void {
    setScores((current) => ({ ...current, [itemKey]: clearScoreFields(current[itemKey], fields) }));
  }
  return <Chart abbreviations={{}} items={[buildItem({ number: 1 })]} onScoresClear={clearScores} scores={scores} />;
}
// endregion | Helpers
