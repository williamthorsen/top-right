import type { StatusStrategy } from '@top-right/adapter-github';
import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { applySourceStatus } from '../source-status.ts';

const ITEM: WorkItem = {
  repo: 'owner/tracked',
  number: 1,
  title: 'An issue',
  url: 'https://github.com/owner/tracked/issues/1',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: [],
  relations: [],
};

/** Reads In progress from a `wip` label, so that the test does not depend on the label strategy's label. */
const WIP_STRATEGY: StatusStrategy = {
  read: (item) => (item.labels.includes('wip') ? 'in-progress' : 'to-do'),
  write: () => Promise.reject(new Error('not written in this test')),
};

describe(applySourceStatus, () => {
  const strategyFor = (repo: string): StatusStrategy | undefined =>
    repo === 'owner/tracked' ? WIP_STRATEGY : undefined;

  it("sets each open item's status as its repository's strategy reads it", () => {
    const items = applySourceStatus(
      [
        { ...ITEM, labels: ['wip'] },
        { ...ITEM, number: 2 },
      ],
      strategyFor,
    );

    expect(items.map((item) => item.sourceStatus)).toStrictEqual(['in-progress', 'to-do']);
  });

  it('leaves the status unset on a closed item', () => {
    const [item] = applySourceStatus([{ ...ITEM, state: 'closed', labels: ['wip'] }], strategyFor);

    expect(item).not.toHaveProperty('sourceStatus');
  });

  it('leaves the status unset on an item whose repository has no strategy', () => {
    const [item] = applySourceStatus([{ ...ITEM, repo: 'owner/other', labels: ['wip'] }], strategyFor);

    expect(item).not.toHaveProperty('sourceStatus');
  });
});
