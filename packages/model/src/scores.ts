/** A score that an item can carry. */
export type ScoreField = 'effort' | 'impact' | 'progress' | 'urgency';

/** Score values by field; an absent field is unscored, never defaulted. */
export type Scores = Partial<Record<ScoreField, number>>;

/** Who wrote a score. */
export type Scorer = 'agent' | 'author';

/** A score's value with its provenance. */
export interface ScoreEntry {
  value: number;
  by: Scorer;
  /** When the score was written, as an ISO timestamp. */
  at: string;
  /** The value that the author held before an agent changed it; present only on an agent's entry. */
  previous?: number;
}

/** An item's scores with their provenance, by field. */
export type ItemScores = Partial<Record<ScoreField, ScoreEntry>>;

export const SCORE_FIELDS: readonly ScoreField[] = ['urgency', 'impact', 'effort', 'progress'];

/** The values of the ordinal axes. */
export const AXIS_SCALE: readonly number[] = [1, 2, 3, 4, 5];

/** The effort values, in points. */
export const EFFORT_SCALE: readonly number[] = [1, 2, 3, 5, 8, 13];

/** The step between progress values, as a fraction of the whole. */
export const PROGRESS_STEP = 0.05;

/**
 * Returns an item's scores after `by` writes `values` at `at`. An author write reviews the whole item: Every agent
 * entry becomes the author's and loses its previous value. An agent write leaves an unchanged value alone, and on a
 * changed one records the value that the author last held, which survives later agent writes until a review.
 */
export function applyScoreWrite(existing: ItemScores | undefined, values: Scores, by: Scorer, at: string): ItemScores {
  const result: ItemScores = {};
  for (const field of SCORE_FIELDS) {
    const entry =
      by === 'author'
        ? writeAuthorEntry(existing?.[field], values[field], at)
        : writeAgentEntry(existing?.[field], values[field], at);
    if (entry) result[field] = entry;
  }
  return result;
}

/** Returns effort × (1 − progress), with a missing progress as none done, or undefined when the effort is unknown. */
export function computeRemainingScope(scores: ItemScores | undefined): number | undefined {
  const effort = scores?.effort?.value;
  return effort === undefined ? undefined : effort * (1 - (scores?.progress?.value ?? 0));
}

/** Returns whether `value` lies on the scale of `field`; progress is a fraction from 0 to 1 in steps of 0.05. */
export function isValidScore(field: ScoreField, value: number): boolean {
  switch (field) {
    case 'urgency':
    case 'impact':
      return AXIS_SCALE.includes(value);
    case 'effort':
      return EFFORT_SCALE.includes(value);
    case 'progress':
      return isProgressStep(value);
  }
}

/** Returns an item's scores after the author keeps them at `at`: an author write of no values. */
export function keepItemScores(existing: ItemScores | undefined, at: string): ItemScores {
  return applyScoreWrite(existing, {}, 'author', at);
}

/** Returns the values of `scores` without their provenance. */
export function readScoreValues(scores: ItemScores | undefined): Scores {
  const values: Scores = {};
  for (const field of SCORE_FIELDS) {
    const entry = scores?.[field];
    if (entry) values[field] = entry.value;
  }
  return values;
}

// region | Helpers
function isProgressStep(value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > 1) return false;
  const steps = value / PROGRESS_STEP;
  // Absorb the float error of values such as 0.15 / 0.05.
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function writeAgentEntry(entry: ScoreEntry | undefined, value: number | undefined, at: string): ScoreEntry | undefined {
  if (value === undefined || entry?.value === value) return entry;
  const previous = entry?.by === 'author' ? entry.value : entry?.previous;
  return { value, by: 'agent', at, ...(previous !== undefined && { previous }) };
}

function writeAuthorEntry(
  entry: ScoreEntry | undefined,
  value: number | undefined,
  at: string,
): ScoreEntry | undefined {
  if (value !== undefined) return { value, by: 'author', at };
  if (!entry) return undefined;
  return entry.by === 'agent'
    ? { value: entry.value, by: 'author', at }
    : { value: entry.value, by: 'author', at: entry.at };
}
// endregion | Helpers
