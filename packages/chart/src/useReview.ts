import {
  applyScoreWrite,
  isAgentScored,
  type ItemScores,
  listReviewQueue,
  type ReviewQueueKind,
  type Scores,
  type WorkItem,
} from '@top-right/model';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';

export interface ReviewOptions {
  items: readonly WorkItem[];
  scores: Readonly<Record<string, ItemScores>>;
  selectedKey: string | undefined;
  setSelectedKey: (key: string | undefined) => void;
  setPreviewKey: (key: string | undefined) => void;
  onKeep: ((itemKey: string) => void) | undefined;
  onScoresChange: ((itemKey: string, scores: Scores) => void) | undefined;
}

/** The review queues and the running review, with the actions that step through it and the chart's key handling. */
export interface Review {
  kind: ReviewQueueKind | undefined;
  /** The item keys of each queue, top-right first. */
  queues: Readonly<Record<ReviewQueueKind, string[]>>;
  /** The selected item's 0-based position in the running queue, or undefined when it is outside the queue. */
  position: number | undefined;
  /** Returns whether a running review fades the item, which it does to every item outside its queue. */
  isFaded: (key: string) => boolean;
  start: (kind: ReviewQueueKind) => void;
  skip: () => void;
  end: () => void;
  keep: (itemKey: string) => void;
  changeScores: (itemKey: string, scores: Scores) => void;
}

/**
 * Runs the review queues over the chart's selection: Starting a queue selects its first item, an item that leaves the
 * queue gives way to the next, Enter keeps the selected item and advances, and Escape ends the review before it clears
 * the selection.
 */
export function useReview({
  items,
  scores,
  selectedKey,
  setSelectedKey,
  setPreviewKey,
  onKeep,
  onScoresChange,
}: ReviewOptions): Review {
  const [kind, setKind] = useState<ReviewQueueKind>();
  const queues = useMemo(
    () => ({ agent: listReviewQueue('agent', items, scores), unscored: listReviewQueue('unscored', items, scores) }),
    [items, scores],
  );
  const queue = kind === undefined ? undefined : queues[kind];
  const queueKeys = useMemo(() => new Set(queue), [queue]);
  const index = queue === undefined || selectedKey === undefined ? -1 : queue.indexOf(selectedKey);

  /** Selects the queue item after `key`, or, when `key` leaves the queue, the one that takes its place. */
  function advance(key: string | undefined, isLeaving: boolean): void {
    if (!queue) return;
    const from = key === undefined ? -1 : queue.indexOf(key);
    const remaining = isLeaving ? queue.filter((candidate) => candidate !== key) : queue;
    if (remaining.length === 0) {
      setKind(undefined);
      setSelectedKey(undefined);
      return;
    }
    const next = from < 0 ? 0 : (isLeaving ? from : from + 1) % remaining.length;
    setSelectedKey(remaining[next]);
  }

  function keep(itemKey: string): void {
    setSelectedKey(itemKey);
    onKeep?.(itemKey);
    if (kind !== undefined && itemKey === selectedKey) advance(itemKey, kind === 'agent');
  }

  function changeScores(itemKey: string, changed: Scores): void {
    // Editing a previewed item selects it, so that the pane stays on it once the pointer leaves.
    setSelectedKey(itemKey);
    onScoresChange?.(itemKey, changed);
    if (kind === undefined || itemKey !== selectedKey || !queueKeys.has(itemKey)) return;
    const after = applyScoreWrite(scores[itemKey], changed, 'author', '');
    if (kind === 'agent' || (after.urgency !== undefined && after.impact !== undefined)) advance(itemKey, true);
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (kind !== undefined) {
        setKind(undefined);
        return;
      }
      setSelectedKey(undefined);
      setPreviewKey(undefined);
      return;
    }
    if (event.key !== 'Enter' || kind === undefined || selectedKey === undefined || isControl(event.target)) return;
    event.preventDefault();
    if (onKeep && isAgentScored(scores[selectedKey])) keep(selectedKey);
    else advance(selectedKey, false);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      handleKey(event);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    kind,
    queues,
    position: index < 0 ? undefined : index,
    isFaded: (key) => queue !== undefined && !queueKeys.has(key),
    start: (startKind) => {
      const [first] = queues[startKind];
      if (first === undefined) return;
      setKind(startKind);
      setSelectedKey(first);
      setPreviewKey(undefined);
    },
    skip: () => advance(selectedKey, false),
    end: () => setKind(undefined),
    keep,
    changeScores,
  };
}

// region | Helpers
/** Returns whether a key press on `target` belongs to a control, which handles Enter itself. */
function isControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest('button, input, select, textarea, a, [role="button"], [role="radio"], [role="slider"]') !== null
  );
}
// endregion | Helpers
