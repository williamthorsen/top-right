import { Chart, type SettableStatus } from '@top-right/chart';
import {
  applyScoreWrite,
  clearScoreFields,
  describeAbbreviationClash,
  formatItemKey,
  type ItemPatch,
  type ItemScores,
  keepItemScores,
  type LabelDimension,
  parseItemKey,
  removeDimensionLabels,
  type ScoreField,
  type Scores,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';

import { type ItemsResponse, itemsResponseSchema, repoReadsResponseSchema } from '#src/shared/items-response.ts';
import { scoresResponseSchema, statusPatchSchema, statusResponseSchema } from '#src/shared/write-requests.ts';

import { AppHeader } from './AppHeader.tsx';
import { describeError, getJson, HostResponseError, postJson } from './host-requests.ts';
import { buildChartHref, buildSettingsHref, readUrlItem } from './page-hrefs.ts';
import { useStoredMagnification } from './useStoredMagnification.ts';
import { useUrlSelection } from './useUrlSelection.ts';

/** The dimensions whose scores the host keeps in an issue's labels. */
const LABEL_DIMENSIONS: readonly LabelDimension[] = ['urgency', 'value', 'effort'];

/**
 * The page: the chart of the configured repositories' open issues, whose scores and status it writes to the host, with
 * the selected item in the URL. It asks the host for the repositories that the chart shows.
 */
export function App(): ReactElement {
  type LoadState = { kind: 'error'; message: string } | { kind: 'loaded'; data: ItemsResponse } | { kind: 'loading' };
  // How the page asks the host for repositories' issues: from its last reads, or read afresh.
  type ReadPath = '/api/items/read' | '/api/items/refresh';
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [scores, setScores] = useState<Record<string, ItemScores>>({});
  const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});
  const [failure, setFailure] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shownRepos, setShownRepos] = useState<ReadonlySet<string>>();
  const [selectedKey, changeSelectedKey] = useUrlSelection();
  const [magnification, changeMagnification] = useStoredMagnification();
  // Writes for one item run in order, so that a late response cannot overwrite a newer change.
  const writeQueues = useRef(new Map<string, Promise<void>>());
  // The repositories that a read or a refresh is fetching, which a second request for them skips.
  const reposInFlight = useRef(new Set<string>());
  // The repositories that the chart showed when it last reported, so that a report asks only for the newly shown ones.
  const lastShown = useRef<ReadonlySet<string>>(new Set());
  // A refresh answered after a write at the source may have read the issues before it, so the client re-applies newer
  // writes.
  const itemWrites = useRef(new Map<string, { patch: ItemPatch; sequence: number }>());
  const itemWriteCount = useRef(0);

  // Replaces only the issues of the requested repositories, so that a read cannot overwrite a score or status write in
  // progress, and returns the repositories whose answered read is stale.
  const readRepos = useCallback(async (path: ReadPath, requested: readonly string[]): Promise<string[]> => {
    const repos = requested.filter((repo) => !reposInFlight.current.has(repo));
    if (repos.length === 0) return [];
    for (const repo of repos) reposInFlight.current.add(repo);
    setIsRefreshing(true);
    const startedAfter = itemWriteCount.current;
    try {
      const answer = await postJson(path, { repos }, repoReadsResponseSchema);
      const readRepoSet = new Set(repos);
      const newer = new Map<string, ItemPatch>();
      for (const [itemKey, write] of itemWrites.current) {
        if (write.sequence > startedAfter) newer.set(itemKey, write.patch);
        else if (readRepoSet.has(parseItemKey(itemKey)?.repo ?? '')) itemWrites.current.delete(itemKey);
      }
      const items = applyPatches(answer.items, newer);
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
      return listStaleRepos(answer.reads);
    } catch (error) {
      const verb = path === '/api/items/read' ? 'read' : 'refreshed';
      setFailure(`Issues not ${verb}: ${endSentence(describeError(error))}`);
      return [];
    } finally {
      for (const repo of repos) reposInFlight.current.delete(repo);
      setIsRefreshing(reposInFlight.current.size > 0);
    }
  }, []);

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
        setState({ kind: 'error', message: describeError(error) });
      }
    })();
  }, [readRepos]);

  useEffect(() => {
    function recordVisitEnd(): void {
      navigator.sendBeacon('/api/visit');
    }
    window.addEventListener('pagehide', recordVisitEnd);
    return () => window.removeEventListener('pagehide', recordVisitEnd);
  }, []);

  const header = (
    <AppHeader chartHref={buildChartHref(selectedKey)} current="chart" settingsHref={buildSettingsHref(selectedKey)} />
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

  function enqueueWrite(itemKey: string, write: () => Promise<void>): void {
    const earlier = writeQueues.current.get(itemKey);
    const queued = (async () => {
      await earlier;
      await write();
    })();
    writeQueues.current.set(itemKey, queued);
  }

  /** Applies the fields that a write at the source changed, and keeps them for a refresh that read before the write. */
  function applyPatch(itemKey: string, patch: ItemPatch): void {
    if (patch.labels === undefined && patch.sourceStatus === undefined) return;
    itemWriteCount.current += 1;
    const merged = { ...itemWrites.current.get(itemKey)?.patch, ...patch };
    itemWrites.current.set(itemKey, { patch: merged, sequence: itemWriteCount.current });
    const written = new Map([[itemKey, patch]]);
    setState((current) =>
      current.kind === 'loaded'
        ? { ...current, data: { ...current.data, items: applyPatches(current.data.items, written) } }
        : current,
    );
  }

  function changeScores(itemKey: string, changed: Scores): void {
    const previous = scores[itemKey];
    const at = new Date().toISOString();
    setScores((current) => ({ ...current, [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', at) }));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/scores', { itemKey, scores: changed }, scoresResponseSchema);
        if (body.labels) applyPatch(itemKey, { labels: body.labels });
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Score not saved: ${describeError(error)}. Try again.`);
      }
    });
  }

  function clearScores(itemKey: string, fields: readonly ScoreField[]): void {
    const previous = scores[itemKey];
    const item = data.items.find((candidate) => formatItemKey(candidate) === itemKey);
    const dimensions = LABEL_DIMENSIONS.filter((dimension) => fields.includes(dimension));
    setScores((current) => ({ ...current, [itemKey]: clearScoreFields(current[itemKey], fields) }));
    // Drop the labels too, so that a label score does not show in the cleared row until the host answers.
    if (item && dimensions.length > 0) {
      applyPatch(itemKey, { labels: removeDimensionLabels(item.labels, dimensions, data.scoreLabelMapping) });
    }
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/scores/clear', { itemKey, fields }, scoresResponseSchema);
        if (body.labels) applyPatch(itemKey, { labels: body.labels });
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        if (item && dimensions.length > 0) applyPatch(itemKey, { labels: item.labels });
        setFailure(`Score not cleared: ${describeError(error)}. Try again.`);
      }
    });
  }

  function keepScores(itemKey: string): void {
    const previous = scores[itemKey];
    const at = new Date().toISOString();
    setScores((current) => ({ ...current, [itemKey]: keepItemScores(current[itemKey], at) }));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/keep', { itemKey }, scoresResponseSchema);
        if (body.labels) applyPatch(itemKey, { labels: body.labels });
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Scores not kept: ${describeError(error)}. Try again.`);
      }
    });
  }

  function changeStatus(itemKey: string, status: SettableStatus, sourceState: 'closed' | 'open'): void {
    const previous = overrides[itemKey];
    // Set To do as an override too, so that an item whose source says In progress shows To do until the host answers.
    const optimistic: StatusOverride = { status, sourceState, at: new Date().toISOString() };
    setOverrides((current) => replaceEntry(current, itemKey, optimistic));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/status', { itemKey, status, sourceState }, statusResponseSchema);
        applyPatch(itemKey, pickStatusPatch(body));
        setOverrides((current) => replaceEntry(current, itemKey, body.override ?? undefined));
      } catch (error) {
        // Apply the item's new fields when the host wrote the source before its store failed.
        const written = error instanceof HostResponseError ? statusPatchSchema.safeParse(error.body) : undefined;
        if (written?.success) applyPatch(itemKey, pickStatusPatch(written.data));
        setOverrides((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Status not saved: ${describeError(error)}. Try again.`);
      }
    });
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
      {data.abbreviationClashes.map((clash) => (
        <div className="host-alert" key={clash.abbreviation} role="alert">
          <span>{describeAbbreviationClash(clash)}</span>
          <a href={buildSettingsHref(selectedKey)}>Settings</a>
        </div>
      ))}
      {failure === undefined ? null : (
        <div className="host-alert" role="alert">
          <span>{failure}</span>
          <button className="host-button" onClick={() => setFailure(undefined)} type="button">
            Dismiss
          </button>
        </div>
      )}
      <Chart
        abbreviations={data.abbreviations}
        collections={data.collections}
        defaultCollectionId={data.defaultCollectionId ?? undefined}
        items={data.items}
        magnification={magnification}
        onKeep={keepScores}
        onMagnificationChange={changeMagnification}
        onScoresChange={changeScores}
        onScoresClear={clearScores}
        onSelectedKeyChange={changeSelectedKey}
        onShownReposChange={followShownRepos}
        onStatusChange={(itemKey, status) => {
          const item = data.items.find((candidate) => formatItemKey(candidate) === itemKey);
          if (item) changeStatus(itemKey, status, item.state);
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
        settingsHref={buildSettingsHref(selectedKey)}
        workTypeMapping={data.workTypeMapping}
      />
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

/** Returns the repositories whose read the host judged stale. */
function listStaleRepos(reads: ItemsResponse['reads']): string[] {
  return Object.entries(reads)
    .filter(([, read]) => read.isStale)
    .map(([repo]) => repo);
}

/**
 * Returns the oldest read time among `repos`, or among every read when none of `repos` has been read, as an ISO
 * timestamp; undefined without any read.
 */
function findOldestRead(reads: ItemsResponse['reads'], repos: readonly string[]): string | undefined {
  const shown = repos.flatMap((repo) => reads[repo]?.readAt ?? []);
  const candidates = shown.length > 0 ? shown : Object.values(reads).map((read) => read.readAt);
  return candidates.toSorted()[0];
}

/** Returns the labels, source status, and status label that a status answer contains, without its other fields. */
function pickStatusPatch({ labels, sourceStatus, sourceStatusLabel }: ItemPatch): ItemPatch {
  return {
    ...(labels !== undefined && { labels }),
    ...(sourceStatus !== undefined && { sourceStatus }),
    ...(sourceStatusLabel !== undefined && { sourceStatusLabel }),
  };
}

/** Returns `record` with `key` set to `value`, or without `key` when `value` is undefined. */
function replaceEntry<T>(record: Readonly<Record<string, T>>, key: string, value: T | undefined): Record<string, T> {
  const rest = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}
// endregion | Helpers
