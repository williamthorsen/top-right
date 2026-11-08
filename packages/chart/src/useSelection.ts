import { type SetStateAction, useLayoutEffect, useRef, useState } from 'react';

export interface SelectionOptions {
  /** The host's selected key, read only while `onSelectedKeyChange` is passed. */
  selectedKey: string | undefined;
  onSelectedKeyChange: ((key: string | undefined, options: { push: boolean }) => void) | undefined;
}

/** The chart's selection, with setters that state whether a change is a history entry. */
export interface Selection {
  selectedKey: string | undefined;
  /** Whether the host passed a key that the chart has not reported or acknowledged, as on a load or a Back. */
  isArrival: boolean;
  /** Records the current key as known, so that it is no longer an arrival. */
  acknowledge: () => void;
  /** Selects as a history entry. */
  push: (key: string | undefined) => void;
  /** Selects in place of the current history entry. */
  replace: (next: SetStateAction<string | undefined>) => void;
}

/**
 * Holds the selection in state, or, when the host passes `onSelectedKeyChange`, reads it from `selectedKey` and reports
 * each change to the host.
 */
export function useSelection({ selectedKey, onSelectedKeyChange }: SelectionOptions): Selection {
  const [ownKey, setOwnKey] = useState<string>();
  const [knownKey, setKnownKey] = useState<string>();
  const key = onSelectedKeyChange === undefined ? ownKey : selectedKey;
  // The key as of the last change, so that an updater that runs later resolves against the host's newest key.
  const latest = useRef(key);
  useLayoutEffect(() => {
    latest.current = key;
  }, [key]);

  function change(next: SetStateAction<string | undefined>, push: boolean): void {
    if (onSelectedKeyChange === undefined) {
      setOwnKey(next);
      return;
    }
    const resolved = typeof next === 'function' ? next(latest.current) : next;
    if (resolved === latest.current) return;
    latest.current = resolved;
    setKnownKey(resolved);
    onSelectedKeyChange(resolved, { push });
  }

  return {
    selectedKey: key,
    isArrival: onSelectedKeyChange !== undefined && key !== undefined && key !== knownKey,
    acknowledge: () => setKnownKey(key),
    push: (next) => change(next, true),
    replace: (next) => change(next, false),
  };
}
