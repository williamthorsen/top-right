import { render, screen, within } from '@testing-library/react';
import type { WorkTypeMapping } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { Chart } from '../Chart.tsx';
import { buildItem } from '../test-utils/chart-fixtures.tsx';

const MAPPING: WorkTypeMapping = { bug: ['defect'], feature: ['story', 'epic'], ops: [], task: ['feature'] };

describe('Chart legend', () => {
  it('opens a popover from the Mapping button that lists each work type’s labels', () => {
    render(<Chart abbreviations={{}} items={[buildItem({ number: 1 })]} workTypeMapping={MAPPING} />);

    const button = screen.getByRole('button', { name: 'Mapping' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // jsdom computes an empty accessible name for the closed popover, so the label is checked as an attribute.
    const popover = screen.getByRole('dialog', { hidden: true });
    expect(popover).toHaveAttribute('aria-label', 'Work type mapping');
    expect(button).toHaveAttribute('popovertarget', popover.id);
    expect(popover).toHaveAttribute('popover', 'auto');
    const terms = within(popover).getAllByRole('term', { hidden: true });
    expect(terms.map((term) => term.textContent)).toStrictEqual(['Feature', 'Bug', 'Task', 'Ops']);
    const definitions = within(popover).getAllByRole('definition', { hidden: true });
    expect(definitions.map((definition) => definition.textContent)).toStrictEqual([
      'story, epic',
      'defect',
      'feature',
      'No labels',
    ]);
  });

  it('links the popover to Settings only when the host passes its location, and the strip never', () => {
    const { rerender } = render(<Chart abbreviations={{}} items={[buildItem({ number: 1 })]} />);
    expect(screen.queryByRole('link', { name: 'Edit in Settings', hidden: true })).not.toBeInTheDocument();

    rerender(<Chart abbreviations={{}} items={[buildItem({ number: 1 })]} settingsHref="/settings?item=x" />);

    expect(screen.queryByRole('link', { name: 'Settings', hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit in Settings', hidden: true })).toHaveAttribute(
      'href',
      '/settings?item=x',
    );
  });

  it('names each status fill, Done included', () => {
    render(<Chart abbreviations={{}} items={[buildItem({ number: 1 })]} />);

    const statuses = screen.getByRole('list', { name: 'Status' });
    expect(
      within(statuses)
        .getAllByRole('listitem')
        .map((entry) => entry.textContent),
    ).toStrictEqual(['To do', 'In progress', 'Done', 'Not sized, drawn as 1 point']);
  });

  it('classifies items by the mapping that it is passed', () => {
    render(
      <Chart abbreviations={{}} items={[buildItem({ number: 1, labels: ['feature'] })]} workTypeMapping={MAPPING} />,
    );

    expect(within(screen.getByRole('table')).getByText('Task')).toBeInTheDocument();
  });
});
