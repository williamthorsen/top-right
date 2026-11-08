import { z } from 'zod';

const itemRefSchema = z.object({
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(['closed', 'open']),
});

/** The body of a successful `GET /api/items`. */
export const itemsResponseSchema = z.object({
  items: z.array(
    itemRefSchema.extend({
      labels: z.array(z.string()),
      relations: z.array(
        z.object({ kind: z.enum(['blocked-by', 'blocking', 'parent', 'sub-issue']), ref: itemRefSchema }),
      ),
    }),
  ),
  abbreviations: z.record(z.string(), z.string()),
});

/** The body of a failed `GET /api/items`. */
export const errorResponseSchema = z.object({ error: z.string() });

export type ItemsResponse = z.infer<typeof itemsResponseSchema>;
