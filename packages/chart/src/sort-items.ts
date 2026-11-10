import { type ItemScores, rankLevel, STATUS_ORDER, type StatusCategory, type WorkItem } from '@top-right/model';

/** A table column by which the items sort. */
export type SortColumn = 'effort' | 'id' | 'progress' | 'status' | 'title' | 'type' | 'urgency' | 'value';

export interface ItemSort {
  column: SortColumn;
  direction: 'ascending' | 'descending';
}

/** What a sort reads beyond the item itself. */
export interface SortContext {
  scores: Readonly<Record<string, ItemScores>>;
  statusOf: (item: WorkItem) => StatusCategory;
  typeNameOf: (item: WorkItem) => string;
  keyOf: (item: WorkItem) => string;
}

/**
 * Returns the items sorted by the column: An absent score sorts last in either direction, and items that compare equal
 * keep their order.
 */
export function sortItems(items: readonly WorkItem[], sort: ItemSort, context: SortContext): WorkItem[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return items.toSorted((a, b) => {
    const valueA = readSortValue(a, sort.column, context);
    const valueB = readSortValue(b, sort.column, context);
    if (valueA === undefined || valueB === undefined) {
      if (valueA === valueB) return 0;
      return valueA === undefined ? 1 : -1;
    }
    return sign * compareValues(valueA, valueB);
  });
}

// region | Helpers
type SortValue = number | string | { repo: string; number: number };

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return compareText(a, b);
  if (typeof a === 'object' && typeof b === 'object') return compareText(a.repo, b.repo) || a.number - b.number;
  return 0;
}

/**
 * Returns the value by which the item sorts in the column; the ID sorts by repo, then number, since numbers do not
 * compare across repos.
 */
function readSortValue(item: WorkItem, column: SortColumn, context: SortContext): SortValue | undefined {
  const scores = context.scores[context.keyOf(item)];
  switch (column) {
    case 'effort':
    case 'progress':
      return scores?.[column]?.score;
    case 'urgency':
    case 'value': {
      const level = scores?.[column]?.score;
      return level === undefined ? undefined : rankLevel(level);
    }
    case 'id':
      return { repo: item.repo, number: item.number };
    case 'status':
      return STATUS_ORDER.indexOf(context.statusOf(item));
    case 'title':
      return item.title;
    case 'type':
      return context.typeNameOf(item);
  }
}
// endregion | Helpers
