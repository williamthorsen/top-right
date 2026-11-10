import { rankLevel, type ResolvedItemScores, type UrgencyLevel, type ValueLevel } from './scores.ts';
import { formatItemKey, type ItemRef } from './work-item.ts';

/** A review queue: the items that carry an agent's score, or the items that lack a placing score. */
export type ReviewQueueKind = 'agent' | 'unscored';

/** A cell of the matrix, by its urgency and value. */
export interface Cell {
  urgency: UrgencyLevel;
  value: ValueLevel;
}

/**
 * Returns the cell from which an agent moved the item, or `undefined` when it did not move one within the matrix. An
 * agent entry without a previous value came from the gutter, so the item has no origin in the matrix.
 */
export function findTrailOrigin(scores: ResolvedItemScores | undefined): Cell | undefined {
  if (!isAgentScored(scores)) return undefined;
  const urgency = scores?.urgency;
  const value = scores?.value;
  if (!urgency || !value) return undefined;
  const originUrgency = urgency.by === 'agent' ? urgency.previous : urgency.score;
  const originValue = value.by === 'agent' ? value.previous : value.score;
  if (originUrgency === undefined || originValue === undefined) return undefined;
  if (originUrgency === urgency.score && originValue === value.score) return undefined;
  return { urgency: originUrgency, value: originValue };
}

/** Returns whether any of the item's scores is the agent's, which the author has not yet kept or corrected. */
export function isAgentScored(scores: ResolvedItemScores | undefined): boolean {
  return [scores?.urgency, scores?.value, scores?.effort, scores?.progress].some((entry) => entry?.by === 'agent');
}

/** Returns the keys of the open items in the queue of `kind`, top-right first: value, then urgency, then key. */
export function listReviewQueue(
  kind: ReviewQueueKind,
  items: ReadonlyArray<Pick<ItemRef, 'number' | 'repo' | 'state'>>,
  scores: Readonly<Record<string, ResolvedItemScores>>,
): string[] {
  return items
    .filter((item) => item.state === 'open')
    .map((item) => formatItemKey(item))
    .filter((key) => (kind === 'agent' ? isAgentScored(scores[key]) : isUnplaced(scores[key])))
    .toSorted((a, b) => compareTopRightFirst(a, b, scores));
}

// region | Helpers
function compareTopRightFirst(a: string, b: string, scores: Readonly<Record<string, ResolvedItemScores>>): number {
  const value = rankScore(scores[b]?.value?.score) - rankScore(scores[a]?.value?.score);
  if (value !== 0) return value;
  const urgency = rankScore(scores[b]?.urgency?.score) - rankScore(scores[a]?.urgency?.score);
  if (urgency !== 0) return urgency;
  return a.localeCompare(b);
}

/** Returns whether the item lacks urgency or value, so that it sits in a gutter. */
function isUnplaced(scores: ResolvedItemScores | undefined): boolean {
  return scores?.urgency === undefined || scores.value === undefined;
}

/** Returns a level's rank, or 0 for an unscored axis, which sorts below every level. */
function rankScore(level: UrgencyLevel | ValueLevel | undefined): number {
  return level === undefined ? 0 : rankLevel(level);
}
// endregion | Helpers
