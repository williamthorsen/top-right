import {
  isValidScore,
  SCORE_FIELDS,
  type ScoreField,
  type Scores,
  type ScoreTypes,
  URGENCY_LEVELS,
  VALUE_LEVELS,
} from '@top-right/model';
import { z } from 'zod';

import { itemScoresSchema, statusOverrideSchema } from './items-response.ts';

/** The body of `POST /api/scores/clear`: the item and the scores to clear, each named once. */
export const clearRequestSchema = z.object({
  itemKey: z.string().min(1),
  fields: z
    .array(z.enum(['effort', 'progress', 'urgency', 'value']))
    .min(1, 'expected at least one score')
    .transform((fields) => [...new Set(fields)]),
});

/** The body of `POST /api/keep`: the item whose agent scores the author keeps. */
export const keepRequestSchema = z.object({ itemKey: z.string().min(1) });

/** The body of `POST /api/items/read` or `POST /api/items/refresh`: the repositories whose issues to return. */
export const repoReadsRequestSchema = z.object({ repos: z.array(z.string().min(1)) });

/** The body of `POST /api/scores`: one or more of an item's scores. */
export const scoresRequestSchema = z.object({
  itemKey: z.string().min(1),
  scores: z
    .object({
      urgency: z.enum(URGENCY_LEVELS, 'not a valid urgency score').optional(),
      value: z.enum(VALUE_LEVELS, 'not a valid value score').optional(),
      effort: buildPointsSchema('effort'),
      progress: buildPointsSchema('progress'),
    })
    .strict()
    .refine((scores) => SCORE_FIELDS.some((field) => scores[field] !== undefined), 'expected at least one score'),
});

/** The body of `POST /api/status`: the status to show, with the item's state at its source. */
export const statusRequestSchema = z.object({
  itemKey: z.string().min(1),
  status: z.enum(['in-progress', 'to-do']),
  sourceState: z.enum(['closed', 'open']),
});

/**
 * The body of a successful `POST /api/scores`, `POST /api/scores/clear`, or `POST /api/keep`: the item's resulting
 * scores, and its labels when the host wrote them.
 */
export const scoresResponseSchema = z.object({
  itemKey: z.string(),
  scores: itemScoresSchema,
  labels: z.array(z.string()).exactOptional(),
});

/**
 * The item's labels, source status, and status label after the host wrote its status at the source, which a
 * `POST /api/status` answer contains whether or not the store then failed.
 */
export const statusPatchSchema = z.object({
  labels: z.array(z.string()).exactOptional(),
  sourceStatus: z.enum(['in-progress', 'to-do']).exactOptional(),
  sourceStatusLabel: z.string().exactOptional(),
});

/** The body of a successful `POST /api/status`: the item's resulting override, or `null` when it has none. */
export const statusResponseSchema = statusPatchSchema.extend({
  itemKey: z.string(),
  override: statusOverrideSchema.nullable(),
});

export type ClearRequest = z.infer<typeof clearRequestSchema>;
export type KeepRequest = z.infer<typeof keepRequestSchema>;
export type ScoresRequest = z.infer<typeof scoresRequestSchema>;
export type StatusRequest = z.infer<typeof statusRequestSchema>;

/** Returns the scores without the fields that a parsed request left undefined. */
export function compactScores(scores: { readonly [F in ScoreField]?: ScoreTypes[F] | undefined }): Scores {
  const { urgency, value, effort, progress } = scores;
  return {
    ...(urgency !== undefined && { urgency }),
    ...(value !== undefined && { value }),
    ...(effort !== undefined && { effort }),
    ...(progress !== undefined && { progress }),
  };
}

// region | Helpers
/** Returns the schema of a numeric score of `field`. */
function buildPointsSchema(field: 'effort' | 'progress') {
  return z
    .number()
    .refine((score) => isValidScore(field, score), `not a valid ${field} score`)
    .optional();
}
// endregion | Helpers
