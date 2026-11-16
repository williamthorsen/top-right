import { describe, expect, it, vi } from 'vitest';

import { type AgentEvent, agentEventSchema } from '#src/shared/agent-events.ts';

import { postStream } from '../host-requests.ts';
import { stubFetch } from '../test-utils/fetch-stub.ts';

describe(postStream, () => {
  it('reads a line split across chunks and a last line that lacks a newline', async () => {
    const started = JSON.stringify({ type: 'started', at: '2026-11-08T11:00:00.000Z' });
    const ended = JSON.stringify({ type: 'ended', outcome: 'empty' });
    stubFetch(() => Promise.resolve(streamChunks([started.slice(0, 10), `${started.slice(10)}\n`, '\n', ended])));
    const onLine = vi.fn<(event: AgentEvent) => void>();

    await postStream('/api/agent/run', { prompt: 'Go' }, agentEventSchema, onLine);

    expect(onLine.mock.calls.map(([event]) => event.type)).toStrictEqual(['started', 'ended']);
  });
});

// region | Helpers
/** Returns a response whose body streams each of `chunks` as a separate chunk. */
function streamChunks(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}
// endregion | Helpers
