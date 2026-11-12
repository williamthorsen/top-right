import { NATURAL_SCALE, ZOOM_STEPS } from '@top-right/chart';
import { useState } from 'react';

/** The `localStorage` key under which the page keeps the chart's magnification on this device. */
export const MAGNIFICATION_KEY = 'top-right:magnification';

/**
 * Holds the chart's magnification in `localStorage`, per device: It reads the stored step on mount, the natural size when
 * none is stored or the stored value is not a step, and writes each change.
 */
export function useStoredMagnification(): [number, (magnification: number) => void] {
  const [magnification, setMagnification] = useState(readMagnification);

  function changeMagnification(next: number): void {
    setMagnification(next);
    try {
      localStorage.setItem(MAGNIFICATION_KEY, String(next));
    } catch {
      // Storage that refuses the write leaves the magnification for this page's life only.
    }
  }

  return [magnification, changeMagnification];
}

// region | Helpers
/** Returns the stored magnification when it is one of the steps, and the natural size otherwise. */
function readMagnification(): number {
  let stored: string | null;
  try {
    stored = localStorage.getItem(MAGNIFICATION_KEY);
  } catch {
    return NATURAL_SCALE;
  }
  const value = Number(stored);
  return stored !== null && ZOOM_STEPS.includes(value) ? value : NATURAL_SCALE;
}
// endregion | Helpers
