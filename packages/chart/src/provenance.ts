import type { LabelScoreEntry, ScoreEntry } from '@top-right/model';

/**
 * Returns a score's provenance line: who set it and when, such as `Author · 8 Nov`, adding the year when it is not
 * `now`'s, or the label that supplies it, such as `Label · value:must-have`.
 */
export function formatProvenance(entry: LabelScoreEntry | ScoreEntry | undefined, now: Date = new Date()): string {
  if (!entry) return 'Unscored';
  if (entry.by === 'label') return `Label · ${entry.label}`;
  const at = new Date(entry.at);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (at.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  const scorer = entry.by === 'agent' ? 'Agent' : 'Author';
  return `${scorer} · ${new Intl.DateTimeFormat(undefined, options).format(at)}`;
}

/** Returns the line under Effort: the points, or that the item is drawn at the floor. */
export function formatPoints(effort: number | undefined): string {
  if (effort === undefined) return 'Unsized, drawn at the floor';
  return `${effort} ${effort === 1 ? 'point' : 'points'}`;
}
