import type { ItemScores } from './scores.ts';
import { formatItemKey, type ItemRef } from './work-item.ts';

/** A review queue: the items that carry an agent's score, or the items that lack a placing score. */
export type ReviewQueueKind = 'agent' | 'unscored';

/** A cell of the matrix, by its urgency and impact. */
export interface Cell {
  urgency: number;
  impact: number;
}

/**
 * Returns the cell from which an agent moved the item, or `undefined` when it did not move one within the matrix. An
 * agent entry without a previous value came from the gutter, so the item has no origin in the matrix.
 */
export function findTrailOrigin(scores: ItemScores | undefined): Cell | undefined {
  if (!isAgentScored(scores)) return undefined;
  const urgency = scores?.urgency;
  const impact = scores?.impact;
  if (!urgency || !impact) return undefined;
  const originUrgency = urgency.by === 'agent' ? urgency.previous : urgency.value;
  const originImpact = impact.by === 'agent' ? impact.previous : impact.value;
  if (originUrgency === undefined || originImpact === undefined) return undefined;
  if (originUrgency === urgency.value && originImpact === impact.value) return undefined;
  return { urgency: originUrgency, impact: originImpact };
}

/** Returns whether any of the item's scores is the agent's, which the author has not yet kept or corrected. */
export function isAgentScored(scores: ItemScores | undefined): boolean {
  return Object.values(scores ?? {}).some((entry) => entry.by === 'agent');
}

/** Returns the keys of the open items in the queue of `kind`, top-right first: impact, then urgency, then key. */
export function listReviewQueue(
  kind: ReviewQueueKind,
  items: ReadonlyArray<Pick<ItemRef, 'number' | 'repo' | 'state'>>,
  scores: Readonly<Record<string, ItemScores>>,
): string[] {
  return items
    .filter((item) => item.state === 'open')
    .map((item) => formatItemKey(item))
    .filter((key) => (kind === 'agent' ? isAgentScored(scores[key]) : isUnplaced(scores[key])))
    .toSorted((a, b) => compareTopRightFirst(a, b, scores));
}

// region | Helpers
function compareTopRightFirst(a: string, b: string, scores: Readonly<Record<string, ItemScores>>): number {
  const impact = (scores[b]?.impact?.value ?? 0) - (scores[a]?.impact?.value ?? 0);
  if (impact !== 0) return impact;
  const urgency = (scores[b]?.urgency?.value ?? 0) - (scores[a]?.urgency?.value ?? 0);
  if (urgency !== 0) return urgency;
  return a.localeCompare(b);
}

/** Returns whether the item lacks urgency or impact, so that it sits in a gutter. */
function isUnplaced(scores: ItemScores | undefined): boolean {
  return scores?.urgency === undefined || scores.impact === undefined;
}
// endregion | Helpers
