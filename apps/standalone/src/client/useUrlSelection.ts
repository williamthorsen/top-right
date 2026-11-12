import { useEffect, useState } from 'react';

import { ITEM_PARAMETER, readUrlItem } from './page-hrefs.ts';

/**
 * Holds the selected item's key in the page URL's `item` parameter: It reads the key on mount and on Back or Forward,
 * and writes each change as a new history entry or in place of the current one.
 */
export function useUrlSelection(): [string | undefined, (key: string | undefined, options: { push: boolean }) => void] {
  const [selectedKey, setSelectedKey] = useState(readUrlItem);

  useEffect(() => {
    function followHistory(): void {
      setSelectedKey(readUrlItem());
    }
    globalThis.addEventListener('popstate', followHistory);
    return () => globalThis.removeEventListener('popstate', followHistory);
  }, []);

  function changeSelectedKey(key: string | undefined, { push }: { push: boolean }): void {
    setSelectedKey(key);
    if (key === readUrlItem()) return;
    const url = new URL(globalThis.location.href);
    if (key === undefined) url.searchParams.delete(ITEM_PARAMETER);
    else url.searchParams.set(ITEM_PARAMETER, key);
    if (push) globalThis.history.pushState(null, '', url);
    else globalThis.history.replaceState(null, '', url);
  }

  return [selectedKey, changeSelectedKey];
}
