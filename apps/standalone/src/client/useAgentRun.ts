import type { ItemScores } from '@top-right/model';
import { useCallback, useRef, useState } from 'react';

import {
  agentDiscardResponseSchema,
  type AgentEvent,
  agentEventSchema,
  type AgentOutcome,
} from '#src/shared/agent-events.ts';

import { describeRequestError, postJson, postStream } from './host-requests.ts';

/** A change that the agent suggested, as the stream reports it. */
export type SuggestedChange = Extract<AgentEvent, { type: 'suggested' }>['changes'][number];

/** One prompt in the conversation and what its run has reported so far. */
export interface AgentRun {
  id: number;
  prompt: string;
  /** The run's stamp, which its suggestions carry; undefined until the host starts it. */
  at: string | undefined;
  /** When the page sent the prompt, in milliseconds since the epoch. */
  startedAt: number;
  /** The tool call that the agent is making, while the run is in progress. */
  activity: string | undefined;
  /** The agent's answer, as its chunks arrive. */
  message: string;
  suggestions: SuggestedChange[];
  outcome: AgentOutcome | undefined;
  /** Why the run failed, or why its suggestions were not discarded. */
  failure: string | undefined;
  isDiscarded: boolean;
}

/** The conversation, whether a run is in progress, and the actions that start, cancel, and discard runs. */
export interface AgentConversation {
  runs: readonly AgentRun[];
  isRunning: boolean;
  start: (prompt: string) => void;
  cancel: () => void;
  discard: (runId: number) => void;
}

/**
 * Holds the page's conversation with the agent: Each prompt is a run whose events the host streams; `onScores`
 * receives the resulting scores of each item that a suggestion or a discard changed.
 */
export function useAgentRun(onScores: (scores: Readonly<Record<string, ItemScores>>) => void): AgentConversation {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const nextId = useRef(1);
  const isRunning = runs.some((run) => run.outcome === undefined);

  const updateRun = useCallback((id: number, update: (run: AgentRun) => AgentRun) => {
    setRuns((current) => current.map((run) => (run.id === id ? update(run) : run)));
  }, []);

  const start = useCallback(
    (prompt: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setRuns((current) => [...current, createRun(id, prompt)]);
      void (async () => {
        try {
          await postStream('/api/agent/run', { prompt }, agentEventSchema, (event) => {
            if (event.type === 'suggested' || event.type === 'discarded') onScores(event.scores);
            updateRun(id, (run) => applyEvent(run, event));
          });
        } catch (error) {
          updateRun(id, (run) => ({ ...run, outcome: 'failed', failure: describeRequestError(error) }));
          return;
        }
        // A stream that ended without its outcome lost its connection to the host.
        updateRun(id, (run) =>
          run.outcome === undefined ? { ...run, outcome: 'failed', failure: 'the host did not respond' } : run,
        );
      })();
    },
    [onScores, updateRun],
  );

  // The host's stream reports the cancelled run's outcome, so the answer to this request carries nothing to read.
  const cancel = useCallback(() => {
    void fetch('/api/agent/cancel', { method: 'POST' }).catch(() => {});
  }, []);

  const discard = useCallback(
    (runId: number) => {
      const run = runs.find((candidate) => candidate.id === runId);
      if (run?.at === undefined) return;
      const { at } = run;
      void (async () => {
        try {
          const { scores } = await postJson('/api/agent/discard', { at }, agentDiscardResponseSchema);
          onScores(scores);
          updateRun(runId, (current) => ({ ...current, isDiscarded: true, failure: undefined }));
        } catch (error) {
          updateRun(runId, (current) => ({ ...current, failure: `Not discarded: ${describeRequestError(error)}` }));
        }
      })();
    },
    [onScores, runs, updateRun],
  );

  return { runs, isRunning, start, cancel, discard };
}

// region | Helpers
/** Returns `run` with what `event` reports. */
function applyEvent(run: AgentRun, event: AgentEvent): AgentRun {
  switch (event.type) {
    case 'started':
      return { ...run, at: event.at };
    case 'activity':
      return { ...run, activity: event.text };
    case 'message':
      return { ...run, message: run.message + event.text };
    case 'suggested':
      return { ...run, suggestions: [...run.suggestions, ...event.changes] };
    case 'discarded':
      return { ...run, isDiscarded: run.suggestions.length > 0 };
    case 'ended':
      return { ...run, activity: undefined, outcome: event.outcome, failure: event.message };
  }
}

/** Returns a run of `prompt` that the host has not yet started. */
function createRun(id: number, prompt: string): AgentRun {
  return {
    id,
    prompt,
    at: undefined,
    startedAt: Date.now(),
    activity: undefined,
    message: '',
    suggestions: [],
    outcome: undefined,
    failure: undefined,
    isDiscarded: false,
  };
}
// endregion | Helpers
