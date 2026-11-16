import { existsSync, readdirSync } from 'node:fs';

import { McpServer } from '@modelcontextprotocol/server';
import { AgentRunError, type RunEvent, type RunPromptOptions } from '@williamthorsen/toolbelt.acp/proposed';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AgentEvent, agentEventSchema } from '#src/shared/agent-events.ts';
import { createMemoryStore } from '#src/test-utils/memory-store.ts';

import { AGENT_INSTRUCTIONS } from '../agent-routes.ts';
import { closeServers, ITEM_KEY, NOW, post, startServer } from '../test-utils/api-server.ts';
import { connectToolClient, type ToolAnswer } from '../test-utils/tool-client.ts';

const AGENT = { harness: 'claude-code' as const };
const AT = NOW.toISOString();
const SUGGESTION = { itemKey: ITEM_KEY, scores: { urgency: 'high' }, reason: 'Blocks the release' };

/** What a scripted agent can do during its run. */
interface AgentTurn {
  callTool: (name: string, args?: Record<string, unknown>) => Promise<ToolAnswer>;
  options: RunPromptOptions;
}

afterEach(closeServers);

describe('POST /api/agent/run', () => {
  it('streams the answer of a run that answers in prose', async () => {
    const url = await startAgentServer(function* () {
      yield message('Two items look urgent.');
      yield stopped('end_turn');
    });

    await expect(runPrompt(url)).resolves.toStrictEqual([
      { type: 'started', at: AT },
      { type: 'message', text: 'Two items look urgent.' },
      { type: 'ended', outcome: 'answered' },
    ]);
  });

  it('streams each suggestion with its reason and keeps it as the agent’s score', async () => {
    const store = createMemoryStore();
    const url = await startAgentServer(async function* ({ callTool }) {
      yield {
        type: 'update',
        update: { sessionUpdate: 'tool_call', toolCallId: '1', title: 'mcp__topright__suggest_scores' },
      };
      await callTool('suggest_scores', { changes: [SUGGESTION] });
      yield stopped('end_turn', { amount: 0.02, currency: 'USD' });
    }, store);

    await expect(runPrompt(url)).resolves.toStrictEqual([
      { type: 'started', at: AT },
      { type: 'activity', text: 'Recording suggestions' },
      {
        type: 'suggested',
        changes: [{ itemKey: ITEM_KEY, field: 'urgency', to: 'high', reason: 'Blocks the release' }],
        scores: { [ITEM_KEY]: { urgency: { score: 'high', by: 'agent', at: AT, reason: 'Blocks the release' } } },
      },
      { type: 'ended', outcome: 'suggested', cost: { amount: 0.02, currency: 'USD' } },
    ]);
    expect(store.state.scores[ITEM_KEY]?.urgency?.by).toBe('agent');
  });

  it('reports a run that ends without an answer or a suggestion as empty', async () => {
    const url = await startAgentServer(function* () {
      yield message('  ');
      yield stopped('end_turn');
    });

    await expect(runPrompt(url)).resolves.toContainEqual({ type: 'ended', outcome: 'empty' });
  });

  it.each([
    {
      case: 'a run that throws',
      finish: () => {
        throw new Error('The harness is not signed in');
      },
      message: 'The harness is not signed in',
    },
    {
      case: 'a run that stops for another reason',
      finish: () => stopped('max_tokens'),
      message: 'The agent stopped: max_tokens.',
    },
  ])('reports $case as failed and discards its suggestions', async ({ finish, message: failure }) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createMemoryStore();
    const url = await startAgentServer(async function* ({ callTool }) {
      await callTool('suggest_scores', { changes: [SUGGESTION] });
      yield finish();
    }, store);

    const events = await runPrompt(url);

    expect(events.slice(-2)).toStrictEqual([
      { type: 'discarded', scores: { [ITEM_KEY]: {} } },
      { type: 'ended', outcome: 'failed', message: failure },
    ]);
    expect(store.state.scores).toStrictEqual({});
    log.mockRestore();
  });

  it.each([
    {
      case: 'an agent that exited',
      details: { exitCode: 1 },
      message: 'The agent `claude-agent-acp` failed (exited 1): API Error: Couldn’t connect through your proxy',
    },
    {
      case: 'an agent that was killed',
      details: { signal: 'SIGKILL' as const },
      message:
        'The agent `claude-agent-acp` failed (killed by SIGKILL): API Error: Couldn’t connect through your proxy',
    },
    {
      case: 'an agent still running',
      details: {},
      message: 'The agent `claude-agent-acp` failed: API Error: Couldn’t connect through your proxy',
    },
  ])('names the failure of $case without its stderr, which the host logs', async ({ details, message: failure }) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const url = await startAgentServer(() => {
      throw new AgentRunError(
        { command: 'claude-agent-acp', stderrTail: '[DEBUG] session log line\n', ...details },
        { cause: new Error('API Error: Couldn’t connect through your proxy') },
      );
    });

    const events = await runPrompt(url);

    expect(events.at(-1)).toStrictEqual({ type: 'ended', outcome: 'failed', message: failure });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] session log line'));
    log.mockRestore();
  });

  it('runs the agent in an empty temporary directory with the instructions and the policy, and removes it', async () => {
    const seen: { cwd: string; files: string[] }[] = [];
    let options: RunPromptOptions | undefined;
    const url = await startAgentServer(function* (turn) {
      options = turn.options;
      seen.push({ cwd: turn.options.cwd, files: readdirSync(turn.options.cwd) });
      yield stopped('end_turn');
    });

    await runPrompt(url);

    expect(seen).toStrictEqual([{ cwd: expect.stringContaining('top-right-agent-'), files: [] }]);
    expect(existsSync(seen[0]?.cwd ?? '')).toBe(false);
    expect(options).toMatchObject({ prompt: 'Score the backlog', instructions: AGENT_INSTRUCTIONS });
    expect(options?.tools?.name).toBe('topright');
    expect(options?.permissionPolicy).toBeTypeOf('function');
  });

  it('refuses a second run while one is in progress', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
    const url = await startAgentServer(async function* () {
      await released;
      yield stopped('end_turn');
    });

    const first = post(`${url}/api/agent/run`, { prompt: 'First' });
    const reader = (await first).body?.getReader();
    await reader?.read();
    const second = await post(`${url}/api/agent/run`, { prompt: 'Second' });

    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toStrictEqual({ error: 'Another run is in progress.' });
    release(undefined);
    await reader?.cancel();
  });

  it('cancels the run when the page closes the stream, discarding its suggestions', async () => {
    const store = createMemoryStore();
    const url = await startAgentServer(async function* ({ callTool, options }) {
      await callTool('suggest_scores', { changes: [SUGGESTION] });
      yield message('Thinking');
      await new Promise((resolve) => options.signal?.addEventListener('abort', resolve));
      throw new Error('cancelled');
    }, store);
    const controller = new AbortController();

    const response = await post(`${url}/api/agent/run`, { prompt: 'Score' }, controller.signal);
    const reader = response.body?.getReader();
    await reader?.read();
    controller.abort();

    await vi.waitFor(() => {
      expect(store.state.scores).toStrictEqual({});
    });
  });

  it('cancels the run on request, streaming the discard and the outcome', async () => {
    const store = createMemoryStore();
    const url = await startAgentServer(async function* ({ callTool, options }) {
      await callTool('suggest_scores', { changes: [SUGGESTION] });
      yield message('Thinking');
      await new Promise((resolve) => options.signal?.addEventListener('abort', resolve));
      throw new Error('cancelled');
    }, store);

    const response = await post(`${url}/api/agent/run`, { prompt: 'Score' });
    const reader = response.body?.getReader();
    await reader?.read();
    const cancelled = await post(`${url}/api/agent/cancel`, {});
    const rest = await readRest(reader);

    expect(cancelled.status).toBe(204);
    expect(rest).toContain('"type":"discarded"');
    expect(rest).toContain('{"type":"ended","outcome":"cancelled"}');
    expect(store.state.scores).toStrictEqual({});
    await expect(post(`${url}/api/agent/cancel`, {})).resolves.toHaveProperty('status', 409);
  });

  it('is absent when the config names no agent', async () => {
    const url = await startServer({});

    const response = await post(`${url}/api/agent/run`, { prompt: 'Score' });

    await expect(response.text()).resolves.toBe('next');
  });
});

describe('POST /api/agent/discard', () => {
  it('discards a finished run’s suggestions', async () => {
    const store = createMemoryStore();
    const url = await startAgentServer(async function* ({ callTool }) {
      await callTool('suggest_scores', { changes: [SUGGESTION] });
      yield stopped('end_turn');
    }, store);
    await runPrompt(url);

    const response = await post(`${url}/api/agent/discard`, { at: AT });

    await expect(response.json()).resolves.toStrictEqual({ scores: { [ITEM_KEY]: {} } });
    expect(store.state.scores).toStrictEqual({});
  });

  it('refuses a stamp that is not a finished run of this host', async () => {
    const url = await startAgentServer(function* () {
      yield stopped('end_turn');
    });

    const response = await post(`${url}/api/agent/discard`, { at: '2026-01-01T00:00:00.000Z' });

    expect(response.status).toBe(404);
  });
});

// region | Helpers
/** Returns an update that carries a chunk of the agent's answer. */
function message(text: string): RunEvent {
  return { type: 'update', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } };
}

/** Posts a prompt and returns the events of the run's stream once it ends. */
async function runPrompt(url: string): Promise<AgentEvent[]> {
  const response = await post(`${url}/api/agent/run`, { prompt: 'Score the backlog' });
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => agentEventSchema.parse(JSON.parse(line)));
}

/** Returns the text that remains in the stream. */
async function readRest(reader: ReadableStreamDefaultReader<Uint8Array> | undefined): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  for (let chunk = await reader?.read(); chunk && !chunk.done; chunk = await reader?.read()) {
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

/** Starts the API with an agent whose run follows `script`, which may call the run's tools. */
function startAgentServer(
  script: (turn: AgentTurn) => AsyncIterable<RunEvent> | Iterable<RunEvent>,
  store = createMemoryStore(),
): Promise<string> {
  return startServer({
    agent: AGENT,
    store,
    runAgent: async function* (options) {
      const server = await options.tools?.createServer({ era: 'modern' });
      if (!(server instanceof McpServer)) throw new TypeError('expected the run’s MCP server');
      yield* script({ callTool: await connectToolClient(server), options });
    },
  });
}

/** Returns the turn's end, with its cost when given. */
function stopped(stopReason: 'end_turn' | 'max_tokens', cost?: { amount: number; currency: string }): RunEvent {
  return { type: 'stopped', stopReason, ...(cost && { cost }) };
}
// endregion | Helpers
