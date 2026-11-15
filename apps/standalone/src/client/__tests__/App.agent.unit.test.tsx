// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AgentEvent } from '#src/shared/agent-events.ts';
import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';
import { setUpAppEnvironment } from '../test-utils/app-environment.ts';
import { ITEM_KEY, ITEMS } from '../test-utils/app-fixtures.ts';
import { stubFetch } from '../test-utils/fetch-stub.ts';

setUpAppEnvironment();

const WITH_AGENT: ItemsResponse = { ...ITEMS, agent: true };
const RUN_AT = '2026-11-08T11:00:00.000Z';
const SUGGESTED_SCORES = {
  [ITEM_KEY]: {
    urgency: {
      score: 'critical' as const,
      by: 'agent' as const,
      at: RUN_AT,
      previous: 'medium' as const,
      reason: 'Blocks the release',
    },
  },
};
const SUGGESTED_RUN: AgentEvent[] = [
  { type: 'started', at: RUN_AT },
  { type: 'activity', text: 'Recording suggestions' },
  {
    type: 'suggested',
    changes: [{ itemKey: ITEM_KEY, field: 'urgency', from: 'medium', to: 'critical', reason: 'Blocks the release' }],
    scores: SUGGESTED_SCORES,
  },
  { type: 'ended', outcome: 'suggested' },
];

describe('the agent in the app', () => {
  it('offers no toggle when the host runs no agent', async () => {
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));
    render(<App />);
    await screen.findByRole('button', { name: /^T\.12:/ });

    expect(screen.queryByRole('button', { name: 'Agent' })).not.toBeInTheDocument();
  });

  it('opens and closes the panel through the toggle, which reports its state', async () => {
    const user = userEvent.setup();
    stubFetch(() => Promise.resolve(Response.json(WITH_AGENT)));
    render(<App />);
    const toggle = await screen.findByRole('button', { name: 'Agent' });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('complementary', { name: 'Agent' })).toBeInTheDocument();
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary', { name: 'Agent' })).not.toBeInTheDocument();
  });

  it('runs a starter, shows the suggestion on the chart with its reason, and selects its item from the row', async () => {
    const user = userEvent.setup();
    stubFetch((path) =>
      Promise.resolve(path === '/api/agent/run' ? streamEvents(SUGGESTED_RUN) : Response.json(WITH_AGENT)),
    );
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Agent' }));

    await user.click(screen.getByRole('button', { name: 'Score the unscored items' }));
    await user.click(await screen.findByRole('button', { name: /Medium → Critical urgency/ }));

    expect(screen.getByText(/item suggested/)).toHaveTextContent('1 item suggested');
    expect(screen.getByRole('complementary', { name: 'Item detail' })).toHaveTextContent('Blocks the release');
  });

  it('discards a run’s suggestions and applies the scores that the host answers', async () => {
    const user = userEvent.setup();
    stubFetch((path) => {
      if (path === '/api/agent/run') return Promise.resolve(streamEvents(SUGGESTED_RUN));
      if (path === '/api/agent/discard') return Promise.resolve(Response.json({ scores: { [ITEM_KEY]: {} } }));
      return Promise.resolve(Response.json(WITH_AGENT));
    });
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Agent' }));
    await user.click(screen.getByRole('button', { name: 'Suggest urgency changes' }));

    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(await screen.findByText('Discarded')).toBeInTheDocument();
    expect(readPostedBody('/api/agent/discard')).toStrictEqual({ at: RUN_AT });
  });

  it('asks the host to cancel the run in progress', async () => {
    const user = userEvent.setup();
    const { promise: never } = Promise.withResolvers<Response>();
    stubFetch((path) => {
      if (path === '/api/agent/run') return Promise.resolve(streamEvents([{ type: 'started', at: RUN_AT }], never));
      if (path === '/api/agent/cancel') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(Response.json(WITH_AGENT));
    });
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Agent' }));
    await user.click(screen.getByRole('button', { name: 'Suggest urgency changes' }));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(vi.mocked(fetch).mock.calls.some(([input]) => input === '/api/agent/cancel')).toBe(true);
  });

  it('reports a run that the host refuses', async () => {
    const user = userEvent.setup();
    stubFetch((path) =>
      Promise.resolve(
        path === '/api/agent/run'
          ? Response.json({ error: 'Another run is in progress.' }, { status: 409 })
          : Response.json(WITH_AGENT),
      ),
    );
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Agent' }));

    await user.click(screen.getByRole('button', { name: 'Suggest urgency changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed: Another run is in progress.');
  });
});

// region | Helpers
/** Returns the body that the page posted to `path`, parsed as JSON. */
function readPostedBody(path: string): unknown {
  const call = vi.mocked(fetch).mock.calls.find(([input]) => input === path);
  return typeof call?.[1]?.body === 'string' ? JSON.parse(call[1].body) : undefined;
}

/** Returns a response that streams `events` as NDJSON, and stays open until `held` settles when it is given. */
function streamEvents(events: readonly AgentEvent[], held?: Promise<unknown>): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        if (held) await held;
        controller.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
}
// endregion | Helpers
