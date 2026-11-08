import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { listItems, renderItemsText } from '../list-items.ts';

const ITEM: WorkItem = {
  repo: 'o/r',
  number: 7,
  title: 'Plot the issues',
  url: 'https://github.com/o/r/issues/7',
  state: 'open',
  labels: ['feature'],
  relations: [],
};
const AT = '2026-11-08T09:00:00.000Z';

describe(listItems, () => {
  it('returns each item with its key and the user’s scores, or none', () => {
    const scores = { 'o/r#7': { urgency: { value: 4, by: 'author' as const, at: AT } } };

    expect(listItems([ITEM, { ...ITEM, number: 8 }], scores)).toStrictEqual([
      {
        itemKey: 'o/r#7',
        repo: 'o/r',
        number: 7,
        title: 'Plot the issues',
        url: ITEM.url,
        labels: ['feature'],
        scores: scores['o/r#7'],
      },
      {
        itemKey: 'o/r#8',
        repo: 'o/r',
        number: 8,
        title: 'Plot the issues',
        url: ITEM.url,
        labels: ['feature'],
        scores: {},
      },
    ]);
  });
});

describe(renderItemsText, () => {
  it('prints one line per item with a dash for each unscored field', () => {
    const [listed] = listItems([ITEM], { 'o/r#7': { impact: { value: 3, by: 'agent', at: AT } } });

    expect(renderItemsText(listed ? [listed] : [])).toBe('o/r#7  u:- i:3 e:- p:-  Plot the issues\n');
  });
});
