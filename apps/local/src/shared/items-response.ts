import { z } from 'zod';

const itemRefSchema = z.object({
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(['closed', 'open']),
});

const scoreEntrySchema = z.object({
  value: z.number(),
  by: z.enum(['agent', 'author']),
  at: z.string(),
  previous: z.number().exactOptional(),
});

/** An item's scores with their provenance. */
export const itemScoresSchema = z.object({
  urgency: scoreEntrySchema.exactOptional(),
  impact: scoreEntrySchema.exactOptional(),
  effort: scoreEntrySchema.exactOptional(),
  progress: scoreEntrySchema.exactOptional(),
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
      relations: z.array(
        z.object({ kind: z.enum(['blocked-by', 'blocking', 'parent', 'sub-issue']), ref: itemRefSchema }),
      ),
    }),
  ),
  abbreviations: z.record(z.string(), z.string()),
  /** The user's scores by item key. */
  scores: z.record(z.string(), itemScoresSchema),
  /** The user's status overrides that still apply, by item key. */
  overrides: z.record(z.string(), statusOverrideSchema),
  /** When the user's previous visit ended. */
  lastVisitAt: z.string().exactOptional(),
});

/** The body of a failed request to the host. */
export const errorResponseSchema = z.object({ error: z.string() });

export type ItemsResponse = z.infer<typeof itemsResponseSchema>;
