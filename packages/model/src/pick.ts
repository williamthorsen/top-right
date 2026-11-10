import { isBlocked } from './relations.ts';
import { computeRemainingScope, type ItemScores, rankLevel } from './scores.ts';
import { deriveStatus, type StatusOverride } from './status.ts';
import { formatItemKey, type WorkItem } from './work-item.ts';

/**
 * Returns the key of the next pick: among the open items that both axes place and that no open item blocks, the
 * highest rank of urgency plus value, then value, then in progress before to do, then the least remaining scope, then
 * the oldest. An agent's score places an item as the author's does. An item without effort sorts after every item with
 * one, because an unknown scope is not assumed to be small. The key breaks any tie that remains.
 */
export function findNextPick(
  items: readonly WorkItem[],
  scores: Readonly<Record<string, ItemScores>>,
  overrides: Readonly<Record<string, StatusOverride>>,
): string | undefined {
  const candidates: Candidate[] = [];
  for (const item of items) {
    const key = formatItemKey(item);
    const itemScores = scores[key];
    const urgency = itemScores?.urgency?.score;
    const value = itemScores?.value?.score;
    if (item.state !== 'open' || urgency === undefined || value === undefined || isBlocked(item)) continue;
    candidates.push({
      key,
      urgency: rankLevel(urgency),
      value: rankLevel(value),
      isInProgress: deriveStatus(item, overrides[key]) === 'in-progress',
      remaining: computeRemainingScope(itemScores),
      createdAt: item.createdAt,
    });
  }
  return candidates.toSorted(compareCandidates)[0]?.key;
}

// region | Helpers
interface Candidate {
  key: string;
  /** The rank of the urgency. */
  urgency: number;
  /** The rank of the value. */
  value: number;
  isInProgress: boolean;
  /** The remaining scope, or undefined when the effort is unknown. */
  remaining: number | undefined;
  createdAt: string;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    b.urgency + b.value - (a.urgency + a.value) ||
    b.value - a.value ||
    Number(b.isInProgress) - Number(a.isInProgress) ||
    compareRemaining(a.remaining, b.remaining) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.key.localeCompare(b.key)
  );
}

function compareRemaining(a: number | undefined, b: number | undefined): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return a - b;
}
// endregion | Helpers
