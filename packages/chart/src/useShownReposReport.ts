import { useEffect, useEffectEvent } from 'react';

/**
 * Reports the repositories that the filter shows, on mount and on each change of their contents, so that a host can
 * read the repositories that it lacks; undefined stands for every repository.
 */
export function useShownReposReport(
  shownRepos: ReadonlySet<string> | undefined,
  onShownReposChange: ((repos: ReadonlySet<string> | undefined) => void) | undefined,
): void {
  // The filter derives a new set on each change, so the effect keys on the contents.
  const contentsKey = shownRepos === undefined ? undefined : JSON.stringify([...shownRepos].toSorted());
  const report = useEffectEvent(() => onShownReposChange?.(shownRepos));
  useEffect(() => {
    report();
  }, [contentsKey]);
}
