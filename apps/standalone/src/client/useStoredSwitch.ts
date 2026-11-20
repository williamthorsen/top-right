import { useState } from 'react';

/** The `localStorage` keys under which the page keeps the chart's switches on this device. */
export const SHOW_TITLES_KEY = 'top-right:show-titles';
export const SHOW_LINES_KEY = 'top-right:show-lines';

/**
 * Holds a switch's state in `localStorage` under `key`, per device: It reads the stored state on mount, `fallback` when
 * none is stored or the stored value is neither `true` nor `false`, and writes each change.
 */
export function useStoredSwitch(key: string, fallback: boolean): [boolean, (isOn: boolean) => void] {
  const [isOn, setIsOn] = useState(() => readSwitch(key, fallback));

  function changeSwitch(next: boolean): void {
    setIsOn(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Storage that refuses the write leaves the state for this page's life only.
    }
  }

  return [isOn, changeSwitch];
}

// region | Helpers
/** Returns the stored state when it is `true` or `false`, and `fallback` otherwise. */
function readSwitch(key: string, fallback: boolean): boolean {
  let stored: string | null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return fallback;
}
// endregion | Helpers
