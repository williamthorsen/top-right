import { useEffect, useEffectEvent } from 'react';

import type { Selection } from './useSelection.ts';

export interface VisibleSelection {
  /** The selected key while the filter shows its item, else undefined. */
  selectedKey: string | undefined;
  /** Whether this render widened the filter to show a key that the host selected. */
  isRevealing: boolean;
}

/**
 * Keeps the selection within the filter: A key that the host selects while the filter hides its item calls `reveal`,
 * and any other hidden key, or one that names none of the items, clears in place of the current history entry.
 */
export function useVisibleSelection(
  selection: Selection,
  visibleKeys: ReadonlySet<string>,
  reveal: (key: string) => boolean,
): VisibleSelection {
  const key = selection.selectedKey;
  let isRevealing = false;
  if (selection.isArrival && key !== undefined) {
    selection.acknowledge();
    if (!visibleKeys.has(key)) isRevealing = reveal(key);
  }
  const clearHiddenSelection = useEffectEvent(() => selection.replace(undefined));
  useEffect(() => {
    if (key !== undefined && !visibleKeys.has(key)) clearHiddenSelection();
  }, [key, visibleKeys]);

  return { selectedKey: key !== undefined && visibleKeys.has(key) ? key : undefined, isRevealing };
}
