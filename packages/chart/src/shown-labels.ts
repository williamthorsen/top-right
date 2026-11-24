import { findWorkTypeLabel, type ResolvedItemScores, type WorkItem, type WorkTypeMapping } from '@top-right/model';

/**
 * Returns the item's labels without those that decide a value that the pane shows elsewhere: the label that supplies
 * a displayed urgency, value, or effort, and the label that decides the work type. A label that lost to a stored score
 * or to another label stays.
 */
export function listShownLabels(
  item: WorkItem,
  scores: ResolvedItemScores | undefined,
  workTypeMapping: WorkTypeMapping,
): string[] {
  const scoreLabels = [scores?.urgency, scores?.value, scores?.effort].flatMap((entry) =>
    entry?.by === 'label' ? entry.label : [],
  );
  const hidden = new Set([...scoreLabels, findWorkTypeLabel(item.labels, workTypeMapping)]);
  return item.labels.filter((label) => !hidden.has(label));
}
