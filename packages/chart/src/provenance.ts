import type { ScoreEntry } from '@top-right/model';

/** Returns a score's provenance line, such as `Author · 8 Nov`, adding the year when it is not `now`'s. */
export function formatProvenance(entry: ScoreEntry | undefined, now: Date = new Date()): string {
  if (!entry) return 'Unscored';
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
