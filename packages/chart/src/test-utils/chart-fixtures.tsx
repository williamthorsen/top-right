import { render, type RenderResult } from '@testing-library/react';
import type { ItemScores, StatusOverride, WorkItem } from '@top-right/model';

import { Chart } from '../Chart.tsx';

/** The repository of a built item that names none. */
export const REPO = 'williamthorsen/top-right';

/** Returns an open feature issue in `REPO`, with any field overridden. */
export function buildItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'number'>): WorkItem {
  const repo = overrides.repo ?? REPO;
  return {
    repo,
    title: `Issue ${overrides.number}`,
    url: `https://github.com/${repo}/issues/${overrides.number}`,
    state: 'open',
    createdAt: '2026-11-01T09:00:00Z',
    labels: ['feature'],
    relations: [],
    ...overrides,
  };
}

/** Returns author scores that place an item in the cell at urgency `u` and impact `i`. */
export function place(u: number, i: number): ItemScores {
  const at = '2026-11-08T00:00:00.000Z';
  return { urgency: { value: u, by: 'author', at }, impact: { value: i, by: 'author', at } };
}

/** Renders the chart without a host, so that a score or status change does not reach its props. */
export function renderChart(
  items: WorkItem[],
  abbreviations: Record<string, string> = {},
  scores: Record<string, ItemScores> = {},
  overrides: Record<string, StatusOverride> = {},
): RenderResult {
  return render(<Chart abbreviations={abbreviations} items={items} overrides={overrides} scores={scores} />);
}
