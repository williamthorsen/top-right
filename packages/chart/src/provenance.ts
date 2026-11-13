import type { LabelScoreEntry, ScoreEntry, ScoreField } from '@top-right/model';

/** Returns an effort's points, such as `3 points`. */
export function formatPoints(effort: number): string {
  return `${effort} ${effort === 1 ? 'point' : 'points'}`;
}

/**
 * Returns the caption under a score row, which states only what the control cannot show: who set an agent's score and
 * when, such as `Agent · 8 Nov`, adding the year when it is not `now`'s, or that an unsized item is drawn at the floor.
 */
export function formatScoreCaption(
  field: ScoreField,
  entry: LabelScoreEntry | ScoreEntry | undefined,
  now: Date = new Date(),
): string | undefined {
  if (!entry) return field === 'effort' ? 'Unsized, drawn at the floor' : undefined;
  if (entry.by !== 'agent') return undefined;
  const at = new Date(entry.at);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (at.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return `Agent · ${new Intl.DateTimeFormat(undefined, options).format(at)}`;
}
