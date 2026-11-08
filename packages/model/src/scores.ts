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
// endregion | Helpers
