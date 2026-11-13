import {
  DEFAULT_SCORE_LABEL_MAPPING,
  type ItemRef,
  type ItemScores,
  type LabelLevels,
  parseItemKey,
  planLabelChange,
  type ScoreField,
  type ScoreLabelMapping,
} from '@top-right/model';
import type { Store } from '@top-right/store';

import { describeError } from './http-json.ts';
import type { ItemsCache } from './items-cache.ts';

/** What a host needs to answer an author's write. */
export interface AuthorWriteContext {
  items: ItemsCache;
  labelWriter: LabelWriter | undefined;
  store: Store;
  userId: string;
}

/** Adds and removes an issue's labels at its source, and resolves to the issue's resulting labels. */
export type LabelWriter = (
  ref: Pick<ItemRef, 'number' | 'repo'>,
  change: { add: readonly string[]; remove: readonly string[] },
) => Promise<string[]>;

/**
 * Clears the item's `fields` for the author and returns the HTTP answer. Where the host writes labels, the labels of a
 * cleared urgency, value, or effort are removed first, so that a refused label write leaves the store untouched; the
 * item's other scores and labels stay as they are.
 */
export async function clearAuthorScores(
  { items, labelWriter, store, userId }: AuthorWriteContext,
  itemKey: string,
  fields: readonly ScoreField[],
): Promise<{ status: number; body: unknown }> {
  const levels: LabelLevels = {
    ...(fields.includes('urgency') && { urgency: null }),
    ...(fields.includes('value') && { value: null }),
    ...(fields.includes('effort') && { effort: null }),
  };
  const result: LabelWriteResult = labelWriter
    ? await writeLevelsToLabels(labelWriter, itemKey, levels, (await store.readUserState(userId)).scoreLabelMapping)
    : { kind: 'none' };
  if (result.kind === 'refused') return { status: result.status, body: { error: result.error } };
  if (result.kind === 'none')
    return { status: 200, body: { itemKey, scores: await store.clearScores(userId, itemKey, fields) } };
  return saveAfterLabelWrite(items, itemKey, result.labels, () => store.clearScores(userId, itemKey, fields));
}

/**
 * Writes an author's change and returns the HTTP answer. Where the host writes labels, the urgency, value, and effort
 * that `apply` gives the item go to its labels first, so that a refused label write leaves the store untouched; the
 * store then keeps only the item's other scores.
 */
export async function writeAuthorChange(
  { items, labelWriter, store, userId }: AuthorWriteContext,
  itemKey: string,
  { apply, write }: { apply: (stored: ItemScores | undefined) => ItemScores; write: () => Promise<ItemScores> },
): Promise<{ status: number; body: unknown }> {
  const state = labelWriter ? await store.readUserState(userId) : undefined;
  const result: LabelWriteResult =
    labelWriter && state
      ? await writeLevelsToLabels(
          labelWriter,
          itemKey,
          readLevels(apply(state.scores[itemKey])),
          state.scoreLabelMapping,
        )
      : { kind: 'none' };
  if (result.kind === 'refused') return { status: result.status, body: { error: result.error } };
  if (result.kind === 'none') return { status: 200, body: { itemKey, scores: await write() } };
  return saveAfterLabelWrite(items, itemKey, result.labels, async () => {
    await write();
    return store.clearScores(userId, itemKey, LABELLED_FIELDS);
  });
}

// region | Helpers
/** The scores that live in an item's labels where the host writes them. */
const LABELLED_FIELDS: readonly ScoreField[] = ['urgency', 'value', 'effort'];

/** The outcome of writing an item's levels to its labels. */
type LabelWriteResult =
  { kind: 'none' } | { kind: 'refused'; status: 400 | 502; error: string } | { kind: 'written'; labels: string[] };

/** Returns the urgency, value, and effort of `scores` as the levels that a label write sets. */
function readLevels(scores: ItemScores): LabelLevels {
  return { urgency: scores.urgency?.score, value: scores.value?.score, effort: scores.effort?.score };
}

/**
 * Patches the cached item with the labels that a label write left, then runs `save` and answers with the item's
 * resulting scores and labels, or with 500 when `save` fails after the labels changed.
 */
async function saveAfterLabelWrite(
  items: ItemsCache,
  itemKey: string,
  labels: string[],
  save: () => Promise<ItemScores>,
): Promise<{ status: number; body: unknown }> {
  items.patchItem(itemKey, { labels });
  try {
    const scores = await save();
    return { status: 200, body: { itemKey, scores, labels } };
  } catch (error) {
    const reason = describeError(error);
    return { status: 500, body: { error: `the labels changed at GitHub, but the score was not saved: ${reason}` } };
  }
}

/**
 * Writes `levels` to the item's labels through `writer`, mapped by `mapping` or the default. Levels that leave every
 * dimension absent have nothing to write.
 */
async function writeLevelsToLabels(
  writer: LabelWriter,
  itemKey: string,
  levels: LabelLevels,
  mapping: ScoreLabelMapping | undefined,
): Promise<LabelWriteResult> {
  if (Object.values(levels).every((level) => level === undefined)) return { kind: 'none' };
  const ref = parseItemKey(itemKey);
  if (!ref) return { kind: 'refused', status: 400, error: `${itemKey} is not an item key, owner/name#number` };
  const plan = planLabelChange(levels, mapping ?? DEFAULT_SCORE_LABEL_MAPPING);
  if (plan.kind === 'refused') return { kind: 'refused', status: 400, error: plan.message };
  try {
    return { kind: 'written', labels: await writer(ref, plan) };
  } catch (error) {
    return { kind: 'refused', status: 502, error: describeError(error) };
  }
}
// endregion | Helpers
