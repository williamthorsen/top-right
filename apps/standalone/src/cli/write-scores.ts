import { applyScoreWrite, type ItemScores, SCORE_FIELDS, type ScoreField, type Scores } from '@top-right/model';
import type { Store } from '@top-right/store';

import { compactScores, scoresRequestSchema } from '#src/shared/write-requests.ts';

/** One entry of a score batch: the scores that the agent writes for one item. */
export interface BatchEntry {
  itemKey: string;
  scores: Scores;
}

/** A parsed batch, or the problems that refuse it. */
export type BatchParse = { kind: 'invalid'; problems: string[] } | { kind: 'valid'; entries: BatchEntry[] };

/** A change that writing a batch makes to one field. */
export interface ScoreChange {
  itemKey: string;
  field: ScoreField;
  from: number | undefined;
  to: number;
}

/**
 * Parses a batch of `{ itemKey, scores }` entries, refusing it whole when any entry is malformed, repeats a key, or
 * names an item outside `openKeys`, so that only an item that the source shows as open receives a score.
 */
export function parseScoreBatch(json: unknown, openKeys: ReadonlySet<string>): BatchParse {
  if (!Array.isArray(json))
    return { kind: 'invalid', problems: ['the input is not a JSON array of { itemKey, scores }'] };
  const problems: string[] = [];
  const entries: BatchEntry[] = [];
  const seen = new Set<string>();
  for (const [index, value] of json.entries()) {
    const label = `entry ${index + 1}`;
    const parsed = scoresRequestSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${label}: ${issue.path.join('.') || 'entry'}: ${issue.message}`);
      }
      continue;
    }
    const { itemKey } = parsed.data;
    if (seen.has(itemKey)) problems.push(`${label}: ${itemKey} appears more than once`);
    else if (!openKeys.has(itemKey))
      problems.push(`${label}: ${itemKey} is not an open issue of a configured repository`);
    seen.add(itemKey);
    entries.push({ itemKey, scores: compactScores(parsed.data.scores) });
  }
  return problems.length > 0 ? { kind: 'invalid', problems } : { kind: 'valid', entries };
}

/** Returns the field changes that writing `entries` as the agent at `at` makes to `scores`. */
export function planScoreChanges(
  entries: readonly BatchEntry[],
  scores: Readonly<Record<string, ItemScores>>,
  at: string,
): ScoreChange[] {
  const changes: ScoreChange[] = [];
  for (const { itemKey, scores: values } of entries) {
    const before = scores[itemKey];
    const after = applyScoreWrite(before, values, 'agent', at);
    for (const field of SCORE_FIELDS) {
      const to = after[field]?.value;
      const from = before?.[field]?.value;
      if (to !== undefined && to !== from) changes.push({ itemKey, field, from, to });
    }
  }
  return changes;
}

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

/** Writes each entry through the store as the agent, every entry stamped with the same `at`. */
export async function writeScoreBatch(
  store: Store,
  userId: string,
  entries: readonly BatchEntry[],
  at: string,
): Promise<void> {
  for (const { itemKey, scores } of entries) {
    await store.writeScores(userId, itemKey, scores, 'agent', at);
  }
}
