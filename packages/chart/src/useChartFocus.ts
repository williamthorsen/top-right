import { type Dispatch, type SetStateAction, useState } from 'react';

/** The item that a pointer or a key previews, and the related item that a relation row highlights. */
export interface ChartFocus {
  previewKey: string | undefined;
  setPreviewKey: Dispatch<SetStateAction<string | undefined>>;
  highlightedKey: string | undefined;
  setHighlightedKey: Dispatch<SetStateAction<string | undefined>>;
  /** The item that the pane and the matrix focus on: the preview, else the selection. */
  shownKey: string | undefined;
}

/** Holds the preview and the highlight, dropping a preview that the filter hides and a highlight of an earlier item. */
export function useChartFocus(selectedKey: string | undefined, visibleKeys: ReadonlySet<string>): ChartFocus {
  const [previewKey, setPreviewKey] = useState<string>();
  const [highlightedKey, setHighlightedKey] = useState<string>();
  const [highlightOwner, setHighlightOwner] = useState<string>();
  if (previewKey !== undefined && !visibleKeys.has(previewKey)) setPreviewKey(undefined);

  const shownKey = previewKey ?? selectedKey;
  // A relation row unmounts without a pointer-leave or blur when the pane changes item, so the highlight ends with it.
  if (highlightOwner !== shownKey) {
    setHighlightOwner(shownKey);
    setHighlightedKey(undefined);
  }
  return { previewKey, setPreviewKey, highlightedKey, setHighlightedKey, shownKey };
}
