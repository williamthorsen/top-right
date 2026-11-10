/** The urgency levels, in ascending rank. */
export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/** The value levels, in ascending rank. */
export const VALUE_LEVELS = ['questionable', 'nice-to-have', 'should-have', 'must-have'] as const;

/** The effort values, in points. */
export const EFFORT_SCALE: readonly number[] = [1, 2, 3, 5, 8, 13];

/** The step between progress values, as a fraction of the whole. */
export const PROGRESS_STEP = 0.05;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export type ValueLevel = (typeof VALUE_LEVELS)[number];

/** The type of each score, by field. */
export interface ScoreTypes {
  effort: number;
  progress: number;
  urgency: UrgencyLevel;
  value: ValueLevel;
}

/** A score that an item can carry. */
export type ScoreField = keyof ScoreTypes;

/** Score values by field; an absent field is unscored, never defaulted. */
export type Scores = { [F in ScoreField]?: ScoreTypes[F] };

/** Who wrote a score. */
export type Scorer = 'agent' | 'author';

/** A score with its provenance. */
export interface ScoreEntry<T extends ScoreTypes[ScoreField] = ScoreTypes[ScoreField]> {
  score: T;
  by: Scorer;
  /** When the score was written, as an ISO timestamp. */
  at: string;
  /** The score that the author held before an agent changed it; present only on an agent's entry. */
  previous?: T;
}

/** An item's scores with their provenance, by field. */
export type ItemScores = { [F in ScoreField]?: ScoreEntry<ScoreTypes[F]> };

export const SCORE_FIELDS: readonly ScoreField[] = ['urgency', 'value', 'effort', 'progress'];

/**
 * Returns an item's scores after `by` writes `values` at `at`. An author write reviews the whole item: Every agent
 * entry becomes the author's and loses its previous score. An agent write leaves an unchanged score alone, and on a
 * changed one records the score that the author last held, which survives later agent writes until a review.
 */
export function applyScoreWrite(existing: ItemScores | undefined, values: Scores, by: Scorer, at: string): ItemScores {
  let result: ItemScores = {};
  for (const field of SCORE_FIELDS) result = writeField(result, field, existing?.[field], values[field], by, at);
  return result;
}

/** Returns effort × (1 − progress), with a missing progress as none done, or undefined when the effort is unknown. */
export function computeRemainingScope(scores: ItemScores | undefined): number | undefined {
  const effort = scores?.effort?.score;
  return effort === undefined ? undefined : effort * (1 - (scores?.progress?.score ?? 0));
}

/** Returns whether `value` is a score of `field`; progress is a fraction from 0 to 1 in steps of 0.05. */
export function isValidScore<F extends ScoreField>(field: F, value: unknown): value is ScoreTypes[F] {
  return isScoreOf(field, value);
}

/** Returns an item's scores after the author keeps them at `at`: an author write of no values. */
export function keepItemScores(existing: ItemScores | undefined, at: string): ItemScores {
  return applyScoreWrite(existing, {}, 'author', at);
}

/** Returns the values of `scores` without their provenance. */
export function readScoreValues(scores: ItemScores | undefined): Scores {
  const values: Scores = {};
  for (const field of SCORE_FIELDS) copyScore(values, field, scores?.[field]);
  return values;
}

/** Returns a level's rank on its axis, from 1 for the lowest to 4 for the highest. */
export function rankLevel(level: UrgencyLevel | ValueLevel): number {
  return (isUrgencyLevel(level) ? URGENCY_LEVELS.indexOf(level) : VALUE_LEVELS.indexOf(level)) + 1;
}

// region | Helpers
function copyScore<F extends ScoreField>(values: Scores, field: F, entry: ScoreEntry<ScoreTypes[F]> | undefined): void {
  if (entry) values[field] = entry.score;
}

function isProgressStep(value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > 1) return false;
  const steps = value / PROGRESS_STEP;
  // Absorb the float error of values such as 0.15 / 0.05.
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function isScoreOf(field: ScoreField, value: unknown): boolean {
  switch (field) {
    case 'urgency':
      return isUrgencyLevel(value);
    case 'value':
      return VALUE_LEVELS.some((level) => level === value);
    case 'effort':
      return typeof value === 'number' && EFFORT_SCALE.includes(value);
    case 'progress':
      return typeof value === 'number' && isProgressStep(value);
  }
}

function isUrgencyLevel(value: unknown): value is UrgencyLevel {
  return URGENCY_LEVELS.some((level) => level === value);
}

function writeAgentEntry<T extends ScoreTypes[ScoreField]>(
  entry: ScoreEntry<T> | undefined,
  score: T | undefined,
  at: string,
): ScoreEntry<T> | undefined {
  if (score === undefined || entry?.score === score) return entry;
  const previous = entry?.by === 'author' ? entry.score : entry?.previous;
  return { score, by: 'agent', at, ...(previous !== undefined && { previous }) };
}

function writeAuthorEntry<T extends ScoreTypes[ScoreField]>(
  entry: ScoreEntry<T> | undefined,
  score: T | undefined,
  at: string,
): ScoreEntry<T> | undefined {
  if (score !== undefined) return { score, by: 'author', at };
  if (!entry) return undefined;
  return entry.by === 'agent'
    ? { score: entry.score, by: 'author', at }
    : { score: entry.score, by: 'author', at: entry.at };
}

/** Returns `result` with the entry that `by` writes to `field`, typed per field. */
function writeField<F extends ScoreField>(
  result: ItemScores,
  field: F,
  entry: ScoreEntry<ScoreTypes[F]> | undefined,
  score: ScoreTypes[F] | undefined,
  by: Scorer,
  at: string,
): ItemScores {
  const written =
    by === 'author'
      ? writeAuthorEntry<ScoreTypes[F]>(entry, score, at)
      : writeAgentEntry<ScoreTypes[F]>(entry, score, at);
  // TypeScript refuses a write to `result[field]` for a generic field, so the entry is spread in.
  return written ? { ...result, [field]: written } : result;
}
// endregion | Helpers
