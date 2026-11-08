// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';

import '@testing-library/jest-dom/vitest';

const ITEM_KEY = 'williamthorsen/top-right#12';
const AT = '2026-11-08T10:00:00.000Z';
const ITEMS: ItemsResponse = {
  items: [
    {
      repo: 'williamthorsen/top-right',
      number: 12,
      title: 'Score items',
      url: 'https://github.com/williamthorsen/top-right/issues/12',
      state: 'open',
      labels: ['feature'],
      relations: [],
    },
  ],
  abbreviations: {},
  scores: { [ITEM_KEY]: { urgency: { value: 2, by: 'author', at: AT } } },
  overrides: {},
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe(App, () => {
  it.each([
    {
      case: 'the host reports an error',
      body: { error: 'GitHub rejected the token (401).' },
      expected: 'GitHub rejected the token (401).',
    },
    { case: 'the error body is unrecognized', body: { message: 'Bad gateway' }, expected: 'the host responded 502' },
  ])('if loading fails and $case, shows one alert line that names the cause', async ({ body, expected }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json(body, { status: 502 }))),
    );

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(`Issues did not load: ${expected}`);
  });

  it('while the items load, shows a loading line', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );

    render(<App />);

    expect(screen.getByText('Loading issues')).toBeInTheDocument();
  });

  it('shows a change before the host confirms it, then the scores that the host returns', async () => {
    const user = userEvent.setup();
    const write = Promise.withResolvers<Response>();
    stubFetch((path) => (path === '/api/scores' ? write.promise : Promise.resolve(Response.json(ITEMS))));
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: '5' }));
    expect(within(getGroup('Urgency')).getByRole('radio', { name: '5' })).toBeChecked();

    write.resolve(Response.json({ itemKey: ITEM_KEY, scores: { urgency: { value: 5, by: 'author', at: AT } } }));
    expect(await within(getGroup('Urgency')).findByRole('radio', { name: '5' })).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    {
      case: 'the host reports an error',
      response: () => Promise.resolve(Response.json({ error: 'disk full' }, { status: 500 })),
      expected: 'Score not saved: disk full. Try again.',
    },
    {
      case: 'the host does not respond',
      response: () => Promise.reject(new TypeError('Failed to fetch')),
      expected: 'Score not saved: the host did not respond. Try again.',
    },
  ])('if the write fails because $case, restores the previous score and says so', async ({ response, expected }) => {
    const user = userEvent.setup();
    stubFetch((path) => (path === '/api/scores' ? response() : Promise.resolve(Response.json(ITEMS))));
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: '5' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(within(getGroup('Urgency')).getByRole('radio', { name: '2' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('records the end of the visit when the page is hidden', async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));
    render(<App />);
    await screen.findByRole('button', { name: /^t\.12:/ });

    globalThis.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledWith('/api/visit');
  });
});

// region | Helpers
function getGroup(name: string): HTMLElement {
  return screen.getByRole('radiogroup', { name });
}

async function selectItem(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^t\.12:/ }));
}

function stubFetch(respond: (path: string) => Promise<Response>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      respond(typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname),
    ),
  );
}
// endregion | Helpers
