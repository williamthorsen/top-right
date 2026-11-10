import { DEFAULT_SCORE_LABEL_MAPPING, type ItemScores, type WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { listItems, renderItemsText } from '../list-items.ts';

const ITEM: WorkItem = {
  repo: 'o/r',
  number: 7,
  title: 'Plot the issues',
  url: 'https://github.com/o/r/issues/7',
  state: 'open',
  createdAt: '2026-11-01T09:00:00Z',
  labels: ['feature'],
  relations: [],
};
const AT = '2026-11-08T09:00:00.000Z';

describe(listItems, () => {
  it('returns each item with its key and the user’s scores, or none', () => {
    const scores: Record<string, ItemScores> = { 'o/r#7': { urgency: { score: 'high', by: 'author', at: AT } } };

    expect(listItems([ITEM, { ...ITEM, number: 8 }], scores, DEFAULT_SCORE_LABEL_MAPPING)).toStrictEqual([
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

  it('adds the scores that labels supply where none is stored, marked with the label', () => {
    const labelled = { ...ITEM, labels: ['urgency:low', 'value:must-have'] };
    const scores: Record<string, ItemScores> = { 'o/r#7': { urgency: { score: 'high', by: 'author', at: AT } } };

    expect(listItems([labelled], scores, DEFAULT_SCORE_LABEL_MAPPING)[0]?.scores).toStrictEqual({
      urgency: { score: 'high', by: 'author', at: AT },
      value: { score: 'must-have', by: 'label', label: 'value:must-have' },
    });
  });
});

describe(renderItemsText, () => {
  it('prints one line per item with a dash for each unscored field', () => {
    const [listed] = listItems(
      [ITEM],
      { 'o/r#7': { value: { score: 'should-have', by: 'agent', at: AT } } },
      DEFAULT_SCORE_LABEL_MAPPING,
    );

    expect(renderItemsText(listed ? [listed] : [])).toBe('o/r#7  u:- v:should-have e:- p:-  Plot the issues\n');
  });

  it('marks a score that a label supplies', () => {
    const [listed] = listItems([{ ...ITEM, labels: ['urgency:high'] }], {}, DEFAULT_SCORE_LABEL_MAPPING);

    expect(renderItemsText(listed ? [listed] : [])).toBe('o/r#7  u:high(label) v:- e:- p:-  Plot the issues\n');
  });

  it('marks an effort that a label supplies', () => {
    const [listed] = listItems([{ ...ITEM, labels: ['effort:5'] }], {}, DEFAULT_SCORE_LABEL_MAPPING);

    expect(listed?.scores.effort).toStrictEqual({ score: 5, by: 'label', label: 'effort:5' });
    expect(renderItemsText(listed ? [listed] : [])).toBe('o/r#7  u:- v:- e:5(label) p:-  Plot the issues\n');
  });
});
