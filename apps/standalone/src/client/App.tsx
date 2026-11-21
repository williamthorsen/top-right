import { Chart } from '@top-right/chart';
import { formatItemKey, type ItemPatch, type WorkItem } from '@top-right/model';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';

import { type ItemsResponse, itemsResponseSchema, repoReadsResponseSchema } from '#src/shared/items-response.ts';

import { AppHeader } from './AppHeader.tsx';
import { describeRequestError, getJson, postJson } from './host-requests.ts';
import { buildChartHref, buildSettingsHref, readUrlItem } from './page-hrefs.ts';
import { PageAlerts } from './PageAlerts.tsx';
import { findOldestRead, listStaleRepos } from './repo-reads.ts';
import { clearFailureOf, type Failure } from './request-failure.ts';
import { useAgentPanel } from './useAgentPanel.tsx';
import { useItemWrites } from './useItemWrites.ts';
import { useStoredMagnification } from './useStoredMagnification.ts';
import { SHOW_LINES_KEY, SHOW_TITLES_KEY, useStoredSwitch } from './useStoredSwitch.ts';
import { useUrlSelection } from './useUrlSelection.ts';

/**
 * The page: the chart of the configured repositories' open issues, whose scores and status it writes to the host, with
 * the selected item in the URL. It asks the host for the repositories that the chart shows.
 */
export function App(): ReactElement {
  type LoadState = { kind: 'error'; message: string } | { kind: 'loaded'; data: ItemsResponse } | { kind: 'loading' };
  // How the page asks the host for repositories' issues: from its last reads, or read afresh.
  type ReadPath = '/api/items/read' | '/api/items/refresh';
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [failure, setFailure] = useState<Failure>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shownRepos, setShownRepos] = useState<ReadonlySet<string>>();
  const [selectedKey, changeSelectedKey] = useUrlSelection();
  const [magnification, changeMagnification] = useStoredMagnification();
  const [showTitles, changeShowTitles] = useStoredSwitch(SHOW_TITLES_KEY, false);
  const [showLines, changeShowLines] = useStoredSwitch(SHOW_LINES_KEY, true);
  const patchItems = useCallback((patches: ReadonlyMap<string, ItemPatch>) => {
    setState((current) =>
      current.kind === 'loaded'
        ? { ...current, data: { ...current.data, items: applyPatches(current.data.items, patches) } }
        : current,
    );
  }, []);
  const loaded = state.kind === 'loaded' ? state.data : undefined;
  const writes = useItemWrites(loaded, patchItems, setFailure);
  const { scores, setScores, overrides, setOverrides, countWrites, takeNewerPatches } = writes;
  const agentPanel = useAgentPanel(loaded, setScores, changeSelectedKey);
  // The repositories that a read or a refresh is fetching, which a second request for them skips.
  const reposInFlight = useRef(new Set<string>());
  // The repositories that the chart showed when it last reported, so that a report asks only for the newly shown ones.
  const lastShown = useRef<ReadonlySet<string>>(new Set());

  // Replaces only the issues of the requested repositories, so that a read cannot overwrite a score or status write in
  // progress, and returns the repositories whose answered read is stale.
  const readRepos = useCallback(
    async (path: ReadPath, requested: readonly string[]): Promise<string[]> => {
      const repos = requested.filter((repo) => !reposInFlight.current.has(repo));
      if (repos.length === 0) return [];
      for (const repo of repos) reposInFlight.current.add(repo);
      setIsRefreshing(true);
      const startedAfter = countWrites();
      try {
        const answer = await postJson(path, { repos }, repoReadsResponseSchema);
        const readRepoSet = new Set(repos);
        const items = applyPatches(answer.items, takeNewerPatches(startedAfter, readRepoSet));
        setState((current) =>
          current.kind === 'loaded'
            ? {
                ...current,
                data: {
                  ...current.data,
                  items: [...current.data.items.filter((item) => !readRepoSet.has(item.repo)), ...items],
                  reads: { ...current.data.reads, ...answer.reads },
                },
              }
            : current,
        );
        setFailure(clearFailureOf('read'));
        return listStaleRepos(answer.reads);
      } catch (error) {
        const verb = path === '/api/items/read' ? 'read' : 'refreshed';
        setFailure({ kind: 'read', message: `Issues not ${verb}: ${endSentence(describeRequestError(error))}` });
        return [];
      } finally {
        for (const repo of repos) reposInFlight.current.delete(repo);
        setIsRefreshing(reposInFlight.current.size > 0);
      }
    },
    [countWrites, takeNewerPatches],
  );

  useEffect(() => {
    void (async () => {
      try {
        const item = readUrlItem();
        const path = item === undefined ? '/api/items' : `/api/items?${new URLSearchParams({ item })}`;
        const data = await getJson(path, itemsResponseSchema);
        lastShown.current = new Set(Object.keys(data.reads));
        setScores(data.scores);
        setOverrides(data.overrides);
        setState({ kind: 'loaded', data });
        void readRepos('/api/items/refresh', listStaleRepos(data.reads));
      } catch (error) {
        setState({ kind: 'error', message: describeRequestError(error) });
      }
    })();
  }, [readRepos, setScores, setOverrides]);

  useEffect(() => {
    function recordVisitEnd(): void {
      navigator.sendBeacon('/api/visit');
    }
    window.addEventListener('pagehide', recordVisitEnd);
    return () => window.removeEventListener('pagehide', recordVisitEnd);
  }, []);

  const header = (
    <AppHeader
      agentToggle={agentPanel.toggle}
      agentToggleRef={agentPanel.toggleRef}
      chartHref={buildChartHref(selectedKey)}
      current="chart"
      settingsHref={buildSettingsHref(selectedKey)}
    />
  );
  if (state.kind === 'loading') {
    return (
      <>
        {header}
        <p className="host-status">Loading issues</p>
      </>
    );
  }
  if (state.kind === 'error') {
    return (
      <>
        {header}
        <p className="host-status" role="alert">
          Issues did not load: {state.message}
        </p>
      </>
    );
  }

  const { data } = state;
  // The abbreviations name every configured repository.
  const shownRepoList = Object.keys(data.abbreviations).filter((repo) => shownRepos?.has(repo) ?? true);

  /**
   * Asks the host for the newly shown repositories, which it answers from its last reads with their age judged now,
   * then refreshes those whose read is stale.
   */
  function followShownRepos(repos: ReadonlySet<string> | undefined): void {
    setShownRepos(repos);
    const shown = Object.keys(data.abbreviations).filter((repo) => repos?.has(repo) ?? true);
    const newlyShown = shown.filter((repo) => !lastShown.current.has(repo));
    lastShown.current = new Set(shown);
    void (async () => {
      const stale = await readRepos('/api/items/read', newlyShown);
      await readRepos('/api/items/refresh', stale);
    })();
  }

  const readAt = findOldestRead(data.reads, shownRepoList);
  return (
    <>
      {header}
      <PageAlerts
        clashes={data.abbreviationClashes}
        failure={failure}
        onDismiss={() => setFailure(undefined)}
        settingsHref={buildSettingsHref(selectedKey)}
      />
      <div className="host-page">
        <Chart
          abbreviations={data.abbreviations}
          collections={data.collections}
          defaultCollectionId={data.defaultCollectionId ?? undefined}
          items={data.items}
          magnification={magnification}
          onKeep={writes.keepScores}
          onMagnificationChange={changeMagnification}
          onScoresChange={writes.changeScores}
          onScoresClear={writes.clearScores}
          onSelectedKeyChange={changeSelectedKey}
          onShowLinesChange={changeShowLines}
          onShowTitlesChange={changeShowTitles}
          onShownReposChange={followShownRepos}
          onStatusChange={(itemKey, status) => {
            const item = data.items.find((candidate) => formatItemKey(candidate) === itemKey);
            if (item) writes.changeStatus(itemKey, status, item.state);
          }}
          overrides={overrides}
          refresh={
            readAt === undefined
              ? undefined
              : { readAt, isRefreshing, onRefresh: () => void readRepos('/api/items/refresh', shownRepoList) }
          }
          scoreLabelMapping={data.scoreLabelMapping}
          scores={scores}
          selectedKey={selectedKey}
          showLines={showLines}
          showTitles={showTitles}
          settingsHref={buildSettingsHref(selectedKey)}
          workTypeMapping={data.workTypeMapping}
        />
        {agentPanel.panel}
      </div>
    </>
  );
}

// region | Helpers
/** Returns `text` ending in a period, unless it already ends a sentence, as the host's GitHub messages do. */
function endSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Returns `items` with the fields that each patch names replaced on its item. */
function applyPatches(items: readonly WorkItem[], patches: ReadonlyMap<string, ItemPatch>): WorkItem[] {
  return items.map((item) => {
    const patch = patches.get(formatItemKey(item));
    return patch ? { ...item, ...patch } : item;
  });
}
// endregion | Helpers
