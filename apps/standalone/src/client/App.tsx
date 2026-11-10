import { Chart, type SettableStatus } from '@top-right/chart';
import {
  applyScoreWrite,
  describeAbbreviationClash,
  formatItemKey,
  type ItemScores,
  keepItemScores,
  type Scores,
  type StatusOverride,
} from '@top-right/model';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';

import { type ItemsResponse, itemsResponseSchema, refreshResponseSchema } from '#src/shared/items-response.ts';
import { scoresResponseSchema, statusResponseSchema } from '#src/shared/write-requests.ts';

import { describeError, getJson, postJson } from './host-requests.ts';
import { SETTINGS_PATH } from './SettingsPage.tsx';
import { useUrlSelection } from './useUrlSelection.ts';

/**
 * The page: the chart of the configured repositories' open issues, whose scores and status it writes to the host, with
 * the selected item in the URL.
 */
export function App(): ReactElement {
  type LoadState = { kind: 'error'; message: string } | { kind: 'loaded'; data: ItemsResponse } | { kind: 'loading' };
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [scores, setScores] = useState<Record<string, ItemScores>>({});
  const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});
  const [failure, setFailure] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedKey, changeSelectedKey] = useUrlSelection();
  // Writes for one item run in order, so that a late response cannot overwrite a newer change.
  const writeQueues = useRef(new Map<string, Promise<void>>());
  const refreshRunning = useRef(false);

  // Replaces only the issues, so that a refresh cannot overwrite a score or status write in progress.
  const refreshIssues = useCallback(async (): Promise<void> => {
    if (refreshRunning.current) return;
    refreshRunning.current = true;
    setIsRefreshing(true);
    try {
      const { items, readAt } = await postJson('/api/items/refresh', {}, refreshResponseSchema);
      setState((current) =>
        current.kind === 'loaded' ? { ...current, data: { ...current.data, items, readAt } } : current,
      );
    } catch (error) {
      setFailure(`Issues not refreshed: ${endSentence(describeError(error))}`);
    } finally {
      refreshRunning.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getJson('/api/items', itemsResponseSchema);
        setScores(data.scores);
        setOverrides(data.overrides);
        setState({ kind: 'loaded', data });
        if (data.isStale) void refreshIssues();
      } catch (error) {
        setState({ kind: 'error', message: describeError(error) });
      }
    })();
  }, [refreshIssues]);

  useEffect(() => {
    function recordVisitEnd(): void {
      navigator.sendBeacon('/api/visit');
    }
    window.addEventListener('pagehide', recordVisitEnd);
    return () => window.removeEventListener('pagehide', recordVisitEnd);
  }, []);

  if (state.kind === 'loading') return <p className="host-status">Loading issues</p>;
  if (state.kind === 'error') {
    return (
      <p className="host-status" role="alert">
        Issues did not load: {state.message}
      </p>
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

  function changeScores(itemKey: string, changed: Scores): void {
    const previous = scores[itemKey];
    const at = new Date().toISOString();
    setScores((current) => ({ ...current, [itemKey]: applyScoreWrite(current[itemKey], changed, 'author', at) }));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/scores', { itemKey, scores: changed }, scoresResponseSchema);
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Score not saved: ${describeError(error)}. Try again.`);
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
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Scores not kept: ${describeError(error)}. Try again.`);
      }
    });
  }

  function changeStatus(itemKey: string, status: SettableStatus, sourceState: 'closed' | 'open'): void {
    const previous = overrides[itemKey];
    const optimistic: StatusOverride | undefined =
      status === 'to-do' ? undefined : { status, sourceState, at: new Date().toISOString() };
    setOverrides((current) => replaceEntry(current, itemKey, optimistic));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson('/api/status', { itemKey, status, sourceState }, statusResponseSchema);
        setOverrides((current) => replaceEntry(current, itemKey, body.override ?? undefined));
      } catch (error) {
        setOverrides((current) => replaceEntry(current, itemKey, previous));
        setFailure(`Status not saved: ${describeError(error)}. Try again.`);
      }
    });
  }

  const { data } = state;
  return (
    <>
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
        items={data.items}
        onKeep={keepScores}
        onScoresChange={changeScores}
        onSelectedKeyChange={changeSelectedKey}
        onStatusChange={(itemKey, status) => {
          const item = data.items.find((candidate) => formatItemKey(candidate) === itemKey);
          if (item) changeStatus(itemKey, status, item.state);
        }}
        overrides={overrides}
        refresh={{ readAt: data.readAt, isRefreshing, onRefresh: () => void refreshIssues() }}
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
/** Returns the Settings page's URL, carrying the selected item so that the page's link back restores it. */
function buildSettingsHref(selectedKey: string | undefined): string {
  return selectedKey === undefined ? SETTINGS_PATH : `${SETTINGS_PATH}?${new URLSearchParams({ item: selectedKey })}`;
}

/** Returns `text` ending in a period, unless it already ends a sentence, as the host's GitHub messages do. */
function endSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Returns `record` with `key` set to `value`, or without `key` when `value` is undefined. */
function replaceEntry<T>(record: Readonly<Record<string, T>>, key: string, value: T | undefined): Record<string, T> {
  const rest = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}
// endregion | Helpers
