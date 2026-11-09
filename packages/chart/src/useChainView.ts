import { findLongestBlockerChain, type WorkItem } from '@top-right/model';
import { useMemo, useState } from 'react';

import type { Review } from './useReview.ts';

/** The longest blocker chain's view over the shown items, with the review wrapped so that the two exclude each other. */
export interface ChainView {
  /** The chain's keys from the first blocker to the last blocked item; empty without a chain. */
  chain: string[];
  isShown: boolean;
  /** Returns whether the shown chain fades the item, which it does to every item outside it. */
  isFaded: (key: string) => boolean;
  /** Shows or hides the view; showing it ends a running review. */
  setShown: (isShown: boolean) => void;
  /** The review, whose start hides the view. */
  review: Review;
}

/**
 * Holds the longest chain's view: The chain follows the shown items, and a change that leaves no chain hides the view,
 * so that a later change does not bring back a view that the author no longer sees.
 */
export function useChainView(items: readonly WorkItem[], review: Review): ChainView {
  const [isShown, setIsShown] = useState(false);
  const chain = useMemo(() => findLongestBlockerChain(items), [items]);
  const keys = useMemo(() => new Set(chain), [chain]);
  if (isShown && chain.length === 0) setIsShown(false);

  return {
    chain,
    isShown,
    isFaded: (key) => isShown && !keys.has(key),
    setShown: (next) => {
      if (next && review.kind !== undefined) review.end();
      setIsShown(next);
    },
    review: {
      ...review,
      start: (kind) => {
        setIsShown(false);
        review.start(kind);
      },
    },
  };
}
