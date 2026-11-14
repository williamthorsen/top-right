import { render, type RenderResult } from '@testing-library/react';
import {
  applyScoreWrite,
  type ItemScores,
  keepItemScores,
  type Scores,
  type StatusOverride,
  URGENCY_LEVELS,
  VALUE_LEVELS,
  type WorkItem,
} from '@top-right/model';
import { type ReactElement, useState } from 'react';

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

/** Returns author scores that place an item in the cell whose urgency rank is `u` and value rank is `v`, each 1 to 4. */
export function place(u: number, v: number): ItemScores {
  const urgency = URGENCY_LEVELS[u - 1];
  const value = VALUE_LEVELS[v - 1];
  if (!urgency || !value) throw new RangeError(`no scored cell at urgency ${u}, value ${v}`);
  const at = '2026-11-08T00:00:00.000Z';
  return { urgency: { score: urgency, by: 'author', at }, value: { score: value, by: 'author', at } };
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

/** Renders the chart with a host that applies the author's writes and Keep to its scores, as the page does. */
export function renderReview(items: WorkItem[], initialScores: Record<string, ItemScores>): RenderResult {
  function ReviewHost(): ReactElement {
    const [scores, setScores] = useState(initialScores);
    const at = '2026-11-09T00:00:00.000Z';
    return (
      <Chart
        abbreviations={{}}
        items={items}
        onKeep={(itemKey) => setScores((current) => ({ ...current, [itemKey]: keepItemScores(current[itemKey], at) }))}
        onScoresChange={(itemKey, changed: Scores) =>
          setScores((current) => ({ ...current, [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', at) }))
        }
        scores={scores}
      />
    );
  }
  return render(<ReviewHost />);
}
