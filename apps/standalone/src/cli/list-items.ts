import {
  formatItemKey,
  type ItemScores,
  type ResolvedItemScores,
  resolveItemScores,
  type ScoreField,
  type ScoreLabelMapping,
  type WorkItem,
} from '@top-right/model';

/** An open item as `list-items` reports it, with the user's current scores and the scores that its labels supply. */
export interface ListedItem {
  itemKey: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  labels: string[];
  scores: ResolvedItemScores;
}

/**
 * Returns each item with the user's stored scores for it and, where none is stored, the scores that its labels
 * supply.
 */
export function listItems(
  items: readonly WorkItem[],
  scores: Readonly<Record<string, ItemScores>>,
  mapping: ScoreLabelMapping,
): ListedItem[] {
  return items.map((item) => {
    const itemKey = formatItemKey(item);
    return {
      itemKey,
      repo: item.repo,
      number: item.number,
      title: item.title,
      url: item.url,
      labels: item.labels,
      scores: resolveItemScores(scores[itemKey], item.labels, mapping),
    };
  });
}

/**
 * Returns one line per item: the key, the four scores (`-` when unscored, `(label)` after a label's), and the
 * title.
 */
export function renderItemsText(items: readonly ListedItem[]): string {
  return items
    .map((item) => {
      const values = TEXT_FIELDS.map(([field, letter]) => `${letter}:${formatScore(item.scores[field])}`);
      return `${item.itemKey}  ${values.join(' ')}  ${item.title}\n`;
    })
    .join('');
}

// region | Helpers
function formatScore(entry: ResolvedItemScores[ScoreField]): string {
  if (entry === undefined) return '-';
  return entry.by === 'label' ? `${entry.score}(label)` : String(entry.score);
}

const TEXT_FIELDS: ReadonlyArray<[ScoreField, string]> = [
  ['urgency', 'u'],
  ['value', 'v'],
  ['effort', 'e'],
  ['progress', 'p'],
];
// endregion | Helpers
