// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_WORK_TYPE_MAPPING } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';

import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrolling, which the chart's table calls on each selection.
Element.prototype.scrollIntoView = () => {};

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
      createdAt: '2026-11-01T09:00:00Z',
      labels: ['feature'],
      relations: [],
    },
  ],
  abbreviations: {},
  abbreviationClashes: [],
  workTypeMapping: DEFAULT_WORK_TYPE_MAPPING,
  scores: { [ITEM_KEY]: { urgency: { value: 2, by: 'author', at: AT } } },
  overrides: {},
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, '', '/');
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

  it('names each abbreviation clash and links to Settings with the selected item', async () => {
    globalThis.history.replaceState(null, '', `/?item=${encodeURIComponent(ITEM_KEY)}`);
    const clashing: ItemsResponse = {
      ...ITEMS,
      abbreviationClashes: [{ abbreviation: 'c', repos: ['w/codeassembly', 'w/configs.macos'] }],
    };
    stubFetch(() => Promise.resolve(Response.json(clashing)));

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('"c" is used by w/codeassembly and w/configs.macos.');
    expect(within(alert).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      `/settings?item=${encodeURIComponent(ITEM_KEY)}`,
    );
  });

  it('shows no clash alert while every abbreviation is distinct, and links the chart to Settings', async () => {
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));

    render(<App />);

    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  it('keeps an agent score before the host confirms it, and restores it with an alert when the write fails', async () => {
    const user = userEvent.setup();
    const keep = Promise.withResolvers<Response>();
    const agentScored = { ...ITEMS, scores: { [ITEM_KEY]: { urgency: { value: 2, by: 'agent' as const, at: AT } } } };
    stubFetch((path) => (path === '/api/keep' ? keep.promise : Promise.resolve(Response.json(agentScored))));
    render(<App />);

    await selectItem(user);
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();

    keep.resolve(Response.json({ error: 'disk full' }, { status: 500 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Scores not kept: disk full. Try again.');
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it("turns an item's agent scores into the author's as soon as the author corrects one", async () => {
    const user = userEvent.setup();
    const agentScored = {
      ...ITEMS,
      scores: {
        [ITEM_KEY]: {
          urgency: { value: 2, by: 'agent' as const, at: AT },
          effort: { value: 3, by: 'agent' as const, at: AT },
        },
      },
    };
    stubFetch((path) =>
      path === '/api/scores' ? new Promise<Response>(() => {}) : Promise.resolve(Response.json(agentScored)),
    );
    render(<App />);

    await selectItem(user);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    await user.click(within(getGroup('Impact')).getByRole('radio', { name: '4' }));

    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
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

describe('with the selection in the URL', () => {
  const OTHER_KEY = 'williamthorsen/top-right#13';
  const TWO_ITEMS: ItemsResponse = {
    ...ITEMS,
    items: [
      ...ITEMS.items,
      {
        repo: 'williamthorsen/top-right',
        number: 13,
        title: 'Share a link',
        url: 'https://github.com/williamthorsen/top-right/issues/13',
        state: 'open',
        createdAt: '2026-11-01T09:00:00Z',
        labels: ['feature'],
        relations: [],
      },
    ],
  };

  it('selects the item that the URL names when the page loads', async () => {
    globalThis.history.replaceState(null, '', `/?item=${encodeURIComponent(ITEM_KEY)}`);
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Item detail' })).toHaveTextContent('Score items');
  });

  it('records a click selection as a history entry, so that Back returns to the previous item', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState(null, '', `/?item=${encodeURIComponent(ITEM_KEY)}`);
    stubFetch(() => Promise.resolve(Response.json(TWO_ITEMS)));
    render(<App />);
    const entries = globalThis.history.length;

    const other = await screen.findByRole('button', { name: /^t\.13:/ });
    await user.click(other);
    await user.unhover(other);
    expect(readItemParameter()).toBe(OTHER_KEY);
    expect(globalThis.history.length).toBe(entries + 1);

    globalThis.history.back();

    await waitFor(() =>
      expect(screen.getByRole('complementary', { name: 'Item detail' })).toHaveTextContent('Score items'),
    );
    expect(readItemParameter()).toBe(ITEM_KEY);
  });

  it('records a review step in place of the current entry', async () => {
    const user = userEvent.setup();
    const agentScored = { ...ITEMS, scores: { [ITEM_KEY]: { urgency: { value: 2, by: 'agent' as const, at: AT } } } };
    stubFetch(() => Promise.resolve(Response.json(agentScored)));
    render(<App />);
    const entries = globalThis.history.length;

    await user.click(await screen.findByRole('button', { name: 'Review agent scores (1)' }));

    expect(readItemParameter()).toBe(ITEM_KEY);
    expect(globalThis.history.length).toBe(entries);
  });
});

// region | Helpers
function getGroup(name: string): HTMLElement {
  return screen.getByRole('radiogroup', { name });
}

async function selectItem(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /^t\.12:/ }));
}

function readItemParameter(): string | null {
  return new URLSearchParams(globalThis.location.search).get('item');
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
