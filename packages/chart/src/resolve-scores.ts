import {
  formatItemKey,
  type ItemScores,
  type ResolvedItemScores,
  resolveItemScores,
  type ScoreLabelMapping,
  type WorkItem,
} from '@top-right/model';

/** Returns each item's stored scores with the scores that its labels supply, by item key. */
export function resolveScores(
  items: readonly WorkItem[],
  scores: Readonly<Record<string, ItemScores>>,
  mapping: ScoreLabelMapping,
): Record<string, ResolvedItemScores> {
  const resolved: Record<string, ResolvedItemScores> = {};
  for (const item of items) {
    const key = formatItemKey(item);
    resolved[key] = resolveItemScores(scores[key], item.labels, mapping);
  }
  return resolved;
}
