import {
  applyScoreWrite,
  type ItemScores,
  omitUnchangedScores,
  planLabelChange,
  type ResolvedItemScores,
  SCORE_FIELDS,
  type ScoreField,
  type ScoreLabelMapping,
  type Scores,
  type ScoreTypes,
} from '@top-right/model';
import type { Store } from '@top-right/store';
import { z } from 'zod';

import { compactScores, scoresRequestSchema } from '#src/shared/write-requests.ts';

/** One entry of a score batch: the scores that the agent writes for one item, with why it chose them. */
export interface BatchEntry {
  itemKey: string;
  scores: Scores;
  reason?: string;
}

/** A parsed batch, or the problems that refuse it. */
export type BatchParse = { kind: 'invalid'; problems: string[] } | { kind: 'valid'; entries: BatchEntry[] };

/** A change that writing a batch makes to one field. */
export interface ScoreChange<F extends ScoreField = ScoreField> {
  itemKey: string;
  field: F;
  from: ScoreTypes[F] | undefined;
  to: ScoreTypes[F];
}

/** What `parseScoreBatch` checks each entry against beside its shape. */
export interface BatchLimits {
  /** The items that the source shows as open, by key. */
  openKeys: ReadonlySet<string>;
  /** When given, a level for which the mapping lists no label is refused, as `planLabelChange` refuses it. */
  mapping?: ScoreLabelMapping | undefined;
}

const batchEntrySchema = scoresRequestSchema.extend({ reason: z.string().trim().min(1).optional() });

/**
 * Returns the entries without each score that the item already resolves to, a label's level included, and without an
 * entry left with none, so that an agent's write of the author's level neither marks the item nor reports a change.
 */
export function omitHeldScores(
  entries: readonly BatchEntry[],
  resolved: Readonly<Record<string, ResolvedItemScores>>,
): BatchEntry[] {
  return entries
    .map((entry) => ({ ...entry, scores: omitUnchangedScores(entry.scores, resolved[entry.itemKey]) }))
    .filter(({ scores }) => SCORE_FIELDS.some((field) => scores[field] !== undefined));
}

/**
 * Parses a batch of `{ itemKey, scores, reason? }` entries, refusing it whole when any entry is malformed, repeats a
 * key, names an item outside `openKeys`, or sets a level that `mapping` lists no label for, so that only an item that
 * the source shows as open receives a score.
 */
export function parseScoreBatch(json: unknown, { openKeys, mapping }: BatchLimits): BatchParse {
  if (!Array.isArray(json))
    return { kind: 'invalid', problems: ['the input is not a JSON array of { itemKey, scores }'] };
  const problems: string[] = [];
  const entries: BatchEntry[] = [];
  const seen = new Set<string>();
  for (const [index, value] of json.entries()) {
    const label = `entry ${index + 1}`;
    const parsed = batchEntrySchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${label}: ${issue.path.join('.') || 'entry'}: ${issue.message}`);
      }
      continue;
    }
    const { itemKey, reason } = parsed.data;
    const scores = compactScores(parsed.data.scores);
    if (seen.has(itemKey)) problems.push(`${label}: ${itemKey} appears more than once`);
    else if (!openKeys.has(itemKey))
      problems.push(`${label}: ${itemKey} is not an open issue of a configured repository`);
    const labelPlan = mapping && planLabelChange(scores, mapping);
    if (labelPlan?.kind === 'refused') problems.push(`${label}: ${labelPlan.message}`);
    seen.add(itemKey);
    entries.push({ itemKey, scores, ...(reason !== undefined && { reason }) });
  }
  return problems.length > 0 ? { kind: 'invalid', problems } : { kind: 'valid', entries };
}

/**
 * Returns the field changes that writing `entries` as the agent at `at` makes to the stored `scores`, each reported from
 * the score that the item resolves to in `resolved`, a label's level included.
 */
export function planScoreChanges(
  entries: readonly BatchEntry[],
  scores: Readonly<Record<string, ItemScores>>,
  resolved: Readonly<Record<string, ResolvedItemScores>>,
  at: string,
): ScoreChange[] {
  const changes: ScoreChange[] = [];
  for (const { itemKey, scores: values } of entries) {
    const after = applyScoreWrite(scores[itemKey], values, 'agent', at);
    for (const field of SCORE_FIELDS) {
      const change = planFieldChange(itemKey, field, resolved[itemKey]?.[field]?.score, after[field]?.score);
      if (change) changes.push(change);
    }
  }
  return changes;
}

/**
 * Writes each entry through the store as the agent with its reason, every entry stamped with the same `at`, and returns
 * each item's resulting scores.
 */
export async function writeScoreBatch(
  store: Store,
  userId: string,
  entries: readonly BatchEntry[],
  at: string,
): Promise<Record<string, ItemScores>> {
  const written: Record<string, ItemScores> = {};
  for (const { itemKey, scores, reason } of entries) {
    written[itemKey] = await store.writeScores(userId, itemKey, scores, 'agent', at, reason);
  }
  return written;
}

// region | Helpers
function planFieldChange<F extends ScoreField>(
  itemKey: string,
  field: F,
  from: ScoreTypes[F] | undefined,
  to: ScoreTypes[F] | undefined,
): ScoreChange<F> | undefined {
  return to === undefined || to === from ? undefined : { itemKey, field, from, to };
}
// endregion | Helpers
