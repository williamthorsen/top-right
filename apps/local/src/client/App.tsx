import { Chart, type SettableStatus } from '@top-right/chart';
import {
  applyScoreWrite,
  formatItemKey,
  type ItemScores,
  keepItemScores,
  type Scores,
  type StatusOverride,
} from '@top-right/model';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

import { errorResponseSchema, type ItemsResponse, itemsResponseSchema } from '#src/shared/items-response.ts';
import { scoresResponseSchema, statusResponseSchema } from '#src/shared/write-requests.ts';

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
  const [selectedKey, changeSelectedKey] = useUrlSelection();
  // Writes for one item run in order, so that a late response cannot overwrite a newer change.
  const writeQueues = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    void (async () => {
      try {
        const data = await loadItems();
        setScores(data.scores);
        setOverrides(data.overrides);
        setState({ kind: 'loaded', data });
      } catch (error) {
        setState({ kind: 'error', message: describeError(error) });
      }
    })();
  }, []);

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
        scores={scores}
        selectedKey={selectedKey}
      />
    </>
  );
}

// region | Helpers
/** Returns the reason for a failed request as a phrase: the host's message, or what the client observed. */
function describeError(error: unknown): string {
  if (error instanceof TypeError) return 'the host did not respond';
  return error instanceof Error ? error.message : String(error);
}

async function loadItems(): Promise<ItemsResponse> {
  const response = await fetch('/api/items');
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(readErrorMessage(body, response.status));
  return itemsResponseSchema.parse(body);
}

async function postJson<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody(response);
  if (!response.ok) throw new Error(readErrorMessage(body, response.status));
  return schema.parse(body);
}

/** Returns the response's JSON body, or `undefined` when the body is not JSON. */
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

function readErrorMessage(body: unknown, status: number): string {
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : `the host responded ${status}`;
}

/** Returns `record` with `key` set to `value`, or without `key` when `value` is undefined. */
function replaceEntry<T>(record: Readonly<Record<string, T>>, key: string, value: T | undefined): Record<string, T> {
  const rest = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}
// endregion | Helpers
