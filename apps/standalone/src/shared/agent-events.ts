import { z } from 'zod';

import { itemScoresSchema } from './items-response.ts';

/** The body of `POST /api/agent/run`: the author's instruction. */
export const agentRunRequestSchema = z.object({ prompt: z.string().trim().min(1).max(4000) });

/** The body of `POST /api/agent/discard`: the stamp of the run whose suggestions to discard. */
export const agentDiscardRequestSchema = z.object({ at: z.string().min(1) });

/** The body of a successful `POST /api/agent/discard`: the resulting scores of each item that it changed. */
export const agentDiscardResponseSchema = z.object({ scores: z.record(z.string(), itemScoresSchema) });

const scoreValueSchema = z.union([z.string(), z.number()]);

/** How a run ended, as the page reports it. */
export const agentOutcomeSchema = z.enum(['answered', 'cancelled', 'empty', 'failed', 'suggested']);

/** One line of the run's stream, which `POST /api/agent/run` answers as NDJSON. */
export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), at: z.string() }),
  z.object({ type: z.literal('activity'), text: z.string() }),
  z.object({ type: z.literal('message'), text: z.string() }),
  z.object({
    type: z.literal('suggested'),
    changes: z.array(
      z.object({
        itemKey: z.string(),
        field: z.enum(['effort', 'progress', 'urgency', 'value']),
        from: scoreValueSchema.optional(),
        to: scoreValueSchema,
        reason: z.string(),
      }),
    ),
    scores: z.record(z.string(), itemScoresSchema),
  }),
  z.object({ type: z.literal('discarded'), scores: z.record(z.string(), itemScoresSchema) }),
  z.object({
    type: z.literal('ended'),
    outcome: agentOutcomeSchema,
    message: z.string().optional(),
    cost: z.object({ amount: z.number(), currency: z.string() }).optional(),
  }),
]);

export type AgentEvent = z.infer<typeof agentEventSchema>;

export type AgentOutcome = z.infer<typeof agentOutcomeSchema>;
