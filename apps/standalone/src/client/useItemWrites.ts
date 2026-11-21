import type { SettableStatus } from '@top-right/chart';
import {
  applyScoreWrite,
  clearScoreFields,
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
} from '@top-right/model';
import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';

import type { ItemsResponse } from '#src/shared/items-response.ts';
import { scoresResponseSchema, statusPatchSchema, statusResponseSchema } from '#src/shared/write-requests.ts';

import { describeRequestError, HostResponseError, postJson } from './host-requests.ts';
import { clearFailureOf, type Failure } from './request-failure.ts';

/** The dimensions whose scores the host keeps in an issue's labels. */
const LABEL_DIMENSIONS: readonly LabelDimension[] = ['urgency', 'value', 'effort'];

/** The user's scores and status overrides, with the writes that change them at the host. */
export interface ItemWrites {
  scores: Record<string, ItemScores>;
  setScores: Dispatch<SetStateAction<Record<string, ItemScores>>>;
  overrides: Record<string, StatusOverride>;
  setOverrides: Dispatch<SetStateAction<Record<string, StatusOverride>>>;
  changeScores: (itemKey: string, changed: Scores) => void;
  clearScores: (itemKey: string, fields: readonly ScoreField[]) => void;
  keepScores: (itemKey: string) => void;
  changeStatus: (itemKey: string, status: SettableStatus, sourceState: 'closed' | 'open') => void;
  /** Returns the count of writes at the source so far, which marks the start of a read. */
  countWrites: () => number;
  /** Returns the patches written after write `since`, and forgets the earlier ones for `repos`, which a read covers. */
  takeNewerPatches: (since: number, repos: ReadonlySet<string>) => Map<string, ItemPatch>;
}

/**
 * Holds the user's scores and status overrides and writes their changes to the host, optimistically and in order per
 * item, applying each write's changes at the source through `patchItems`.
 */
export function useItemWrites(
  data: ItemsResponse | undefined,
  patchItems: (patches: ReadonlyMap<string, ItemPatch>) => void,
  setFailure: Dispatch<SetStateAction<Failure | undefined>>,
): ItemWrites {
  const [scores, setScores] = useState<Record<string, ItemScores>>({});
  const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});
  // Writes for one item run in order, so that a late response cannot overwrite a newer change.
  const writeQueues = useRef(new Map<string, Promise<void>>());
  // A refresh answered after a write at the source may have read the issues before it, so the client re-applies newer
  // writes.
  const itemWrites = useRef(new Map<string, { patch: ItemPatch; sequence: number }>());
  const itemWriteCount = useRef(0);

  const countWrites = useCallback(() => itemWriteCount.current, []);
  const takeNewerPatches = useCallback((since: number, repos: ReadonlySet<string>) => {
    const newer = new Map<string, ItemPatch>();
    for (const [itemKey, write] of itemWrites.current) {
      if (write.sequence > since) newer.set(itemKey, write.patch);
      else if (repos.has(parseItemKey(itemKey)?.repo ?? '')) itemWrites.current.delete(itemKey);
    }
    return newer;
  }, []);

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
    patchItems(new Map([[itemKey, patch]]));
  }

  /** Applies `optimistic` to an item's scores and posts the write; a failure restores the scores and calls `undo`. */
  function writeScores(write: ScoreWrite): void {
    const { itemKey, optimistic, path, payload, failure, undo } = write;
    const previous = scores[itemKey];
    setScores((current) => ({ ...current, [itemKey]: optimistic(current[itemKey]) }));
    enqueueWrite(itemKey, async () => {
      try {
        const body = await postJson(path, payload, scoresResponseSchema);
        if (body.labels) applyPatch(itemKey, { labels: body.labels });
        setScores((current) => ({ ...current, [itemKey]: body.scores }));
        setFailure(clearFailureOf('write'));
      } catch (error) {
        setScores((current) => replaceEntry(current, itemKey, previous));
        undo?.();
        setFailure({ kind: 'write', message: `${failure}: ${describeRequestError(error)}. Try again.` });
      }
    });
  }

  function changeScores(itemKey: string, changed: Scores): void {
    const at = new Date().toISOString();
    writeScores({
      itemKey,
      optimistic: (entry) => applyScoreWrite(entry, changed, 'author', at),
      path: '/api/scores',
      payload: { itemKey, scores: changed },
      failure: 'Score not saved',
    });
  }

  function clearScores(itemKey: string, fields: readonly ScoreField[]): void {
    const item = data?.items.find((candidate) => formatItemKey(candidate) === itemKey);
    const dimensions = LABEL_DIMENSIONS.filter((dimension) => fields.includes(dimension));
    const relabeled = item && dimensions.length > 0 ? item : undefined;
    // Drop the labels too, so that a label score does not show in the cleared row until the host answers.
    if (data && relabeled) {
      applyPatch(itemKey, { labels: removeDimensionLabels(relabeled.labels, dimensions, data.scoreLabelMapping) });
    }
    writeScores({
      itemKey,
      optimistic: (entry) => clearScoreFields(entry, fields),
      path: '/api/scores/clear',
      payload: { itemKey, fields },
      failure: 'Score not cleared',
      undo: relabeled && (() => applyPatch(itemKey, { labels: relabeled.labels })),
    });
  }

  function keepScores(itemKey: string): void {
    const at = new Date().toISOString();
    writeScores({
      itemKey,
      optimistic: (entry) => keepItemScores(entry, at),
      path: '/api/keep',
      payload: { itemKey },
      failure: 'Scores not kept',
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
        // The patch schema strips the answer's other fields.
        applyPatch(itemKey, statusPatchSchema.parse(body));
        setOverrides((current) => replaceEntry(current, itemKey, body.override ?? undefined));
        setFailure(clearFailureOf('write'));
      } catch (error) {
        // Apply the item's new fields when the host wrote the source before its store failed.
        const written = error instanceof HostResponseError ? statusPatchSchema.safeParse(error.body) : undefined;
        if (written?.success) applyPatch(itemKey, written.data);
        setOverrides((current) => replaceEntry(current, itemKey, previous));
        setFailure({ kind: 'write', message: `Status not saved: ${describeRequestError(error)}. Try again.` });
      }
    });
  }

  return {
    scores,
    setScores,
    overrides,
    setOverrides,
    changeScores,
    clearScores,
    keepScores,
    changeStatus,
    countWrites,
    takeNewerPatches,
  };
}

// region | Helpers
/** One write of an item's scores: the optimistic change, the request, and what a failure reports and undoes. */
interface ScoreWrite {
  itemKey: string;
  optimistic: (entry: ItemScores | undefined) => ItemScores;
  path: string;
  payload: unknown;
  /** The alert's opening words when the write fails. */
  failure: string;
  undo?: (() => void) | undefined;
}

/** Returns `record` with `key` set to `value`, or without `key` when `value` is undefined. */
function replaceEntry<T>(record: Readonly<Record<string, T>>, key: string, value: T | undefined): Record<string, T> {
  const rest = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}
// endregion | Helpers
