/** The urgency levels, in ascending rank. */
export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

/** The value levels, in ascending rank. */
export const VALUE_LEVELS = ['questionable', 'nice-to-have', 'should-have', 'must-have'] as const;

/** The effort values, in points, in ascending order. */
export const EFFORT_SCALE = [1, 2, 3, 5, 8, 13] as const;

/** The step between progress values, as a fraction of the whole. */
export const PROGRESS_STEP = 0.05;

/** An effort value on the scale, in points. */
export type EffortPoints = (typeof EFFORT_SCALE)[number];

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

/** A score that one of the item's labels supplies, read from the source rather than stored. */
export interface LabelScoreEntry<
  T extends EffortPoints | UrgencyLevel | ValueLevel = EffortPoints | UrgencyLevel | ValueLevel,
> {
  score: T;
  by: 'label';
  /** The item's label as written at its source. */
  label: string;
}

/** An item's stored scores with, where a dimension has none, the scores that its labels supply. */
export interface ResolvedItemScores {
  urgency?: LabelScoreEntry<UrgencyLevel> | ScoreEntry<UrgencyLevel>;
  value?: LabelScoreEntry<ValueLevel> | ScoreEntry<ValueLevel>;
  effort?: LabelScoreEntry<EffortPoints> | ScoreEntry<number>;
  progress?: ScoreEntry<number>;
}

export const SCORE_FIELDS: readonly ScoreField[] = ['urgency', 'value', 'effort', 'progress'];

/**
 * Returns an item's scores after `by` writes `values` at `at`. An author write reviews the whole item: Every agent
 * entry becomes the author's and loses its previous score. An agent write leaves an unchanged score alone, and on a
 * changed one records the score that the author last held, which survives later agent writes until a review.
 */
export function applyScoreWrite(existing: ItemScores | undefined, values: Scores, by: Scorer, at: string): ItemScores {
  const urgency = writeEntry(existing?.urgency, values.urgency, by, at);
  const value = writeEntry(existing?.value, values.value, by, at);
  const effort = writeEntry(existing?.effort, values.effort, by, at);
  const progress = writeEntry(existing?.progress, values.progress, by, at);
  return {
    ...(urgency && { urgency }),
    ...(value && { value }),
    ...(effort && { effort }),
    ...(progress && { progress }),
  };
}

/** Returns an item's scores without the entries of `fields`. */
export function clearScoreFields(existing: ItemScores | undefined, fields: readonly ScoreField[]): ItemScores {
  function isKept(field: ScoreField): boolean {
    return !fields.includes(field);
  }
  return {
    ...(existing?.urgency && isKept('urgency') && { urgency: existing.urgency }),
    ...(existing?.value && isKept('value') && { value: existing.value }),
    ...(existing?.effort && isKept('effort') && { effort: existing.effort }),
    ...(existing?.progress && isKept('progress') && { progress: existing.progress }),
  };
}

/** Returns effort × (1 − progress), with a missing progress as none done, or undefined when the effort is unknown. */
export function computeRemainingScope(scores: ResolvedItemScores | undefined): number | undefined {
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

/** Returns `values` without each field whose resolved score already equals it, so that only a change remains. */
export function omitUnchangedScores(values: Scores, resolved: ResolvedItemScores | undefined): Scores {
  const changed: Scores = {};
  for (const field of SCORE_FIELDS) {
    if (values[field] !== resolved?.[field]?.score) copyValue(changed, field, values[field]);
  }
  return changed;
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

function copyValue<F extends ScoreField>(target: Scores, field: F, value: ScoreTypes[F] | undefined): void {
  if (value !== undefined) target[field] = value;
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
      return EFFORT_SCALE.some((points) => points === value);
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

/** Returns the entry that `by` writes over `entry`. */
function writeEntry<T extends ScoreTypes[ScoreField]>(
  entry: ScoreEntry<T> | undefined,
  score: T | undefined,
  by: Scorer,
  at: string,
): ScoreEntry<T> | undefined {
  return by === 'author' ? writeAuthorEntry(entry, score, at) : writeAgentEntry(entry, score, at);
}
// endregion | Helpers
