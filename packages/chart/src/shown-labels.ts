import {
  deriveStatus,
  findWorkTypeLabel,
  type ResolvedItemScores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';

/**
 * Returns the item's labels without those that decide a value that the pane shows elsewhere: the label that supplies
 * a displayed urgency, value, or effort, the label that decides the work type, and the label from which the source
 * read In progress while the status shows it. A label that lost to a stored score or to another label stays.
 */
export function listShownLabels(
  item: WorkItem,
  scores: ResolvedItemScores | undefined,
  override: StatusOverride | undefined,
  workTypeMapping: WorkTypeMapping,
): string[] {
  const scoreLabels = [scores?.urgency, scores?.value, scores?.effort].flatMap((entry) =>
    entry?.by === 'label' ? entry.label : [],
  );
  const hidden = new Set([...scoreLabels, findWorkTypeLabel(item.labels, workTypeMapping)]);
  // A patch merge keeps `sourceStatusLabel` after a write to To do, so the source must still read In progress.
  if (item.sourceStatus === 'in-progress' && deriveStatus(item, override) === 'in-progress') {
    hidden.add(item.sourceStatusLabel);
  }
  return item.labels.filter((label) => !hidden.has(label));
}
