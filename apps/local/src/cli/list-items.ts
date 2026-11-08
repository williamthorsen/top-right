import { formatItemKey, type ItemScores, type ScoreField, type WorkItem } from '@top-right/model';

/** An open item as `list-items` reports it, with the user's current scores. */
export interface ListedItem {
  itemKey: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  labels: string[];
  scores: ItemScores;
}

/** Returns each item with the user's scores for it. */
export function listItems(items: readonly WorkItem[], scores: Readonly<Record<string, ItemScores>>): ListedItem[] {
  return items.map((item) => {
    const itemKey = formatItemKey(item);
    return {
      itemKey,
      repo: item.repo,
      number: item.number,
      title: item.title,
      url: item.url,
      labels: item.labels,
      scores: scores[itemKey] ?? {},
    };
  });
}

/** Returns one line per item: the key, the four scores (`-` when unscored), and the title. */
export function renderItemsText(items: readonly ListedItem[]): string {
  return items
    .map((item) => {
      const values = TEXT_FIELDS.map(([field, letter]) => `${letter}:${item.scores[field]?.value ?? '-'}`);
      return `${item.itemKey}  ${values.join(' ')}  ${item.title}\n`;
    })
    .join('');
}

// region | Helpers
const TEXT_FIELDS: ReadonlyArray<[ScoreField, string]> = [
  ['urgency', 'u'],
  ['impact', 'i'],
  ['effort', 'e'],
  ['progress', 'p'],
];
// endregion | Helpers
