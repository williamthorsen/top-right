import { URGENCY_LEVELS, VALUE_LEVELS } from '@top-right/model';
import { z } from 'zod';

import {
  abbreviationClashSchema,
  collectionSchema,
  scoreLabelMappingSchema,
  workTypeMappingSchema,
} from './settings.ts';

const itemRefSchema = z.object({
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(['closed', 'open']),
});

/** An item's scores with their provenance. */
export const itemScoresSchema = z.object({
  urgency: buildScoreEntrySchema(z.enum(URGENCY_LEVELS)).exactOptional(),
  value: buildScoreEntrySchema(z.enum(VALUE_LEVELS)).exactOptional(),
  effort: buildScoreEntrySchema(z.number()).exactOptional(),
  progress: buildScoreEntrySchema(z.number()).exactOptional(),
});

/** A stored status override. */
export const statusOverrideSchema = z.object({
  status: z.enum(['in-progress', 'to-do']),
  sourceState: z.enum(['closed', 'open']),
  at: z.string(),
});

/** The body of a successful `GET /api/items`. */
export const itemsResponseSchema = z.object({
  items: z.array(
    itemRefSchema.extend({
      createdAt: z.string(),
      labels: z.array(z.string()),
      sourceStatus: z.enum(['in-progress', 'to-do']).exactOptional(),
      relations: z.array(
        z.object({ kind: z.enum(['blocked-by', 'blocking', 'parent', 'sub-issue']), ref: itemRefSchema }),
      ),
    }),
  ),
  abbreviations: z.record(z.string(), z.string()),
  /** The configured repositories that share an abbreviation. */
  abbreviationClashes: z.array(abbreviationClashSchema),
  /** The user's collections, each without the repositories that the config does not list. */
  collections: z.array(collectionSchema),
  /** The id of the collection that the chart starts at, or `null` for every repository. */
  defaultCollectionId: z.string().nullable(),
  /** The user's work-type mapping, or the default. */
  workTypeMapping: workTypeMappingSchema,
  /** The user's score-label mapping, or the default. */
  scoreLabelMapping: scoreLabelMappingSchema,
  /** The user's stored scores by item key, without the scores that labels supply. */
  scores: z.record(z.string(), itemScoresSchema),
  /** The user's status overrides that still apply, by item key. */
  overrides: z.record(z.string(), statusOverrideSchema),
  /** When the user's previous visit ended. */
  lastVisitAt: z.string().exactOptional(),
  /** When the host started the read of the issues. */
  readAt: z.string(),
  /** Whether the issues are old enough that the page asks the host for a fresh read. */
  isStale: z.boolean(),
});

/** The body of a successful `POST /api/items/refresh`: the issues of a fresh read, without the user's state. */
export const refreshResponseSchema = z.object({
  items: itemsResponseSchema.shape.items,
  readAt: z.string(),
});

/** The body of a failed request to the host. */
export const errorResponseSchema = z.object({ error: z.string() });

export type ItemsResponse = z.infer<typeof itemsResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

// region | Helpers
/** Returns the schema of a score entry whose score and previous score match `score`. */
function buildScoreEntrySchema<T extends z.ZodType>(score: T) {
  return z.object({
    score,
    by: z.enum(['agent', 'author']),
    at: z.string(),
    previous: score.exactOptional(),
  });
}
// endregion | Helpers
