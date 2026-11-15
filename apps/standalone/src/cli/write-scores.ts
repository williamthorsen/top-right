import type { ScoreChange } from '#src/server/score-batch.ts';

/** Returns the report of `changes`: one line per change, then a summary that says whether they were written. */
export function renderChangesText(changes: readonly ScoreChange[], isDryRun: boolean): string {
  const lines = changes.map((change) => `${change.itemKey} ${change.field} ${change.from ?? '-'} → ${change.to}\n`);
  const itemCount = new Set(changes.map((change) => change.itemKey)).size;
  const counted = `${changes.length} ${changes.length === 1 ? 'score' : 'scores'} on ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  if (changes.length === 0)
    lines.push(isDryRun ? 'top-right: no score would change\n' : 'top-right: no score changed\n');
  else if (isDryRun) lines.push(`top-right: ${counted} would change; run without --dry-run to write them\n`);
  else lines.push(`top-right: wrote ${counted}\n`);
  return lines.join('');
}
