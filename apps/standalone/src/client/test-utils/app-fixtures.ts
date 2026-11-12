import { DEFAULT_SCORE_LABEL_MAPPING, DEFAULT_WORK_TYPE_MAPPING } from '@top-right/model';

import type { ItemsResponse } from '#src/shared/items-response.ts';

export const ITEM_KEY = 'williamthorsen/top-right#12';
export const REPO = 'williamthorsen/top-right';
export const AT = '2026-11-08T10:00:00.000Z';
export const ITEMS: ItemsResponse = {
  items: [
    {
      repo: 'williamthorsen/top-right',
      number: 12,
      title: 'Score items',
      url: 'https://github.com/williamthorsen/top-right/issues/12',
      state: 'open',
      createdAt: '2026-11-01T09:00:00Z',
      labels: ['feature'],
      relations: [],
    },
  ],
  abbreviations: { [REPO]: 'T' },
  abbreviationClashes: [],
  collections: [],
  defaultCollectionId: null,
  workTypeMapping: DEFAULT_WORK_TYPE_MAPPING,
  scoreLabelMapping: DEFAULT_SCORE_LABEL_MAPPING,
  scores: { [ITEM_KEY]: { urgency: { score: 'medium', by: 'author', at: AT } } },
  overrides: {},
  reads: { [REPO]: { readAt: AT, isStale: false } },
};
