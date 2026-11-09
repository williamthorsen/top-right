import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { MARGIN_LEFT, MARGIN_TOP } from '../Grid.tsx';
import { CELL_SIZE, GRID_SIZE } from '../layout.ts';
import { buildItem, renderChart } from '../test-utils/chart-fixtures.tsx';

describe(Chart, () => {
  it('renders every gutter list without a transformed ancestor, whose offset WebKit drops from the list', () => {
    renderChart([buildItem({ number: 1 }), buildItem({ number: 2 })]);

    const lists = screen.getAllByRole('list', { name: 'Unscored items' });
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(listTransformedAncestors(list)).toStrictEqual([]);
    }
  });

  it('places the corner gutter cell at the matrix margins', () => {
    renderChart([buildItem({ number: 1 })]);

    // eslint-disable-next-line testing-library/no-node-access -- a foreignObject has no role to query.
    const foreignObject = screen.getByRole('list', { name: 'Unscored items' }).closest('foreignObject');
    expect(foreignObject).toHaveAttribute('x', String(MARGIN_LEFT));
    expect(foreignObject).toHaveAttribute('y', String((GRID_SIZE - 1) * CELL_SIZE + MARGIN_TOP));
  });
});

// region | Helpers

/** Returns the `transform` attributes of the element's ancestors below its `<svg>`. */
function listTransformedAncestors(element: Element): string[] {
  const transforms: string[] = [];
  // eslint-disable-next-line testing-library/no-node-access -- the SVG groups above the list have no role to query.
  for (let node = element.parentElement; node && node.tagName.toLowerCase() !== 'svg'; node = node.parentElement) {
    const transform = node.getAttribute('transform');
    if (transform !== null) transforms.push(transform);
  }
  return transforms;
}

// endregion | Helpers
