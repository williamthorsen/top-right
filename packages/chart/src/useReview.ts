import {
  isAgentScored,
  type ResolvedItemScores,
  listReviewQueue,
  type ReviewQueueKind,
  type Scores,
  type WorkItem,
} from '@top-right/model';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ReviewOptions {
  items: readonly WorkItem[];
  scores: Readonly<Record<string, ResolvedItemScores>>;
  selectedKey: string | undefined;
  /** Selects in place of the current history entry. */
  setSelectedKey: Dispatch<SetStateAction<string | undefined>>;
  /** Selects as a history entry. */
  pushSelectedKey: (key: string | undefined) => void;
  setPreviewKey: (key: string | undefined) => void;
  onKeep: ((itemKey: string) => void) | undefined;
  onScoresChange: ((itemKey: string, scores: Scores) => void) | undefined;
  /** The chart's scroll container, within which the review brings each item that it moves to into view. */
  scrollRef: RefObject<HTMLElement | null>;
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

/** How long a placed item stays selected before the Unscored review moves on, so that the author sees it move. */
const PLACED_ADVANCE_DELAY_MS = 650;

/**
 * Runs the review queues over the chart's selection: Starting a queue selects its first item, Keep and Enter keep the
 * selected item and advance, an item placed during the Unscored review gives way to the next after a pause, and Escape
 * ends the review before it clears the selection. A correction during the Agent-scored review leaves the item selected,
 * so that a second correction lands on the same item.
 */
export function useReview({
  items,
  scores,
  selectedKey,
  setSelectedKey,
  pushSelectedKey,
  setPreviewKey,
  onKeep,
  onScoresChange,
  scrollRef,
}: ReviewOptions): Review {
  const [kind, setKind] = useState<ReviewQueueKind>();
  const queues = useMemo(
    () => ({ agent: listReviewQueue('agent', items, scores), unscored: listReviewQueue('unscored', items, scores) }),
    [items, scores],
  );
  const queue = kind === undefined ? undefined : queues[kind];
  const queueKeys = useMemo(() => new Set(queue), [queue]);
  const index = queue === undefined || selectedKey === undefined ? -1 : queue.indexOf(selectedKey);
  // The queue position of the item that the review last moved to, from which it continues once that item leaves.
  const anchor = useRef(0);
  const pendingAdvance = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(pendingAdvance.current), []);

  // Bring each item that the review moves to into view, since the chart scrolls on a narrow screen.
  useEffect(() => {
    if (kind === undefined || selectedKey === undefined) return;
    const element = scrollRef.current?.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [kind, selectedKey]);

  /** Returns the queue item after `key`, or, when `key` leaves the queue, the one that takes its place. */
  function findNext(key: string | undefined, isLeaving: boolean): string | undefined {
    if (!queue) return undefined;
    const from = key === undefined ? -1 : queue.indexOf(key);
    const remaining = isLeaving ? queue.filter((candidate) => candidate !== key) : queue;
    if (remaining.length === 0) return undefined;
    const next = (from < 0 ? anchor.current : isLeaving ? from : from + 1) % remaining.length;
    anchor.current = next;
    return remaining[next];
  }

  /** Selects the next queue item, or ends the review and clears the selection when none is left. */
  function advance(key: string | undefined, isLeaving: boolean): void {
    if (!queue) return;
    const next = findNext(key, isLeaving);
    if (next === undefined) setKind(undefined);
    setSelectedKey(next);
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
    if (kind !== 'unscored' || itemKey !== selectedKey || !queueKeys.has(itemKey)) return;
    const isPlaced =
      (changed.urgency ?? scores[itemKey]?.urgency) !== undefined &&
      (changed.value ?? scores[itemKey]?.value) !== undefined;
    if (!isPlaced) return;
    const next = findNext(itemKey, true);
    clearTimeout(pendingAdvance.current);
    pendingAdvance.current = setTimeout(() => {
      if (next === undefined) setKind(undefined);
      // Move on only if the author is still on the placed item.
      setSelectedKey((current) => (current === itemKey ? next : current));
    }, PLACED_ADVANCE_DELAY_MS);
  }

  function endReview(): void {
    clearTimeout(pendingAdvance.current);
    setKind(undefined);
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (kind !== undefined) {
        endReview();
        return;
      }
      pushSelectedKey(undefined);
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
      anchor.current = 0;
      setKind(startKind);
      setSelectedKey(first);
      setPreviewKey(undefined);
    },
    skip: () => advance(selectedKey, false),
    end: endReview,
    keep,
    changeScores,
  };
}

// region | Helpers
/** Returns whether `target` handles Enter itself; a radio and a range take no action on Enter, so the review does. */
function isControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      'button:not([role="radio"]), select, textarea, a, [role="button"], input:not([type="radio"], [type="range"])',
    ) !== null
  );
}
// endregion | Helpers
