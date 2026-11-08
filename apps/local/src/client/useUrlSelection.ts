import { useEffect, useState } from 'react';

/** The query parameter that holds the selected item's key. */
const ITEM_PARAMETER = 'item';

/**
 * Holds the selected item's key in the page URL's `item` parameter: It reads the key on mount and on Back or Forward,
 * and writes each change as a new history entry or in place of the current one.
 */
export function useUrlSelection(): [string | undefined, (key: string | undefined, options: { push: boolean }) => void] {
  const [selectedKey, setSelectedKey] = useState(readItemKey);

  useEffect(() => {
    function followHistory(): void {
      setSelectedKey(readItemKey());
    }
    globalThis.addEventListener('popstate', followHistory);
    return () => globalThis.removeEventListener('popstate', followHistory);
  }, []);

  function changeSelectedKey(key: string | undefined, { push }: { push: boolean }): void {
    setSelectedKey(key);
    if (key === readItemKey()) return;
    const url = new URL(globalThis.location.href);
    if (key === undefined) url.searchParams.delete(ITEM_PARAMETER);
    else url.searchParams.set(ITEM_PARAMETER, key);
    if (push) globalThis.history.pushState(null, '', url);
    else globalThis.history.replaceState(null, '', url);
  }

  return [selectedKey, changeSelectedKey];
}

// region | Helpers
function readItemKey(): string | undefined {
  return new URLSearchParams(globalThis.location.search).get(ITEM_PARAMETER) ?? undefined;
}
// endregion | Helpers
