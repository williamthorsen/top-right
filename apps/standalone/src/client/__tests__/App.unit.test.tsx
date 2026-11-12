// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_SCORE_LABEL_MAPPING, DEFAULT_WORK_TYPE_MAPPING } from '@top-right/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';

import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrolling, which the chart's table calls on each selection.
Element.prototype.scrollIntoView = () => {};

// jsdom does not implement `ResizeObserver`, to which the chart's zoom subscribes; these tests do not resize the chart.
// The stub is installed per test because `afterEach` unstubs every global.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

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
  collections: [],
  defaultCollectionId: null,
  workTypeMapping: DEFAULT_WORK_TYPE_MAPPING,
  scoreLabelMapping: DEFAULT_SCORE_LABEL_MAPPING,
  scores: { [ITEM_KEY]: { urgency: { score: 'medium', by: 'author', at: AT } } },
  overrides: {},
  readAt: AT,
  isStale: false,
};

const CRITICAL_BY_LABEL = { itemKey: ITEM_KEY, scores: {}, labels: ['feature', 'urgency:critical'] };

afterEach(() => {
  cleanup();
  localStorage.clear();
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

  it("starts the chart's filter at the user's default collection", async () => {
    const withDefault: ItemsResponse = {
      ...ITEMS,
      abbreviations: { 'williamthorsen/top-right': 'TR' },
      collections: [{ id: 'c1', name: 'Product', repos: ['williamthorsen/top-right'] }],
      defaultCollectionId: 'c1',
    };
    stubFetch(() => Promise.resolve(Response.json(withDefault)));

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Repos: Product' })).toBeInTheDocument();
  });

  it('shows no clash alert while every abbreviation is distinct', async () => {
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));

    render(<App />);

    expect(await screen.findByRole('complementary', { name: 'Item detail' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the chart as the current page and links the header to Settings with the selected item', async () => {
    globalThis.history.replaceState(null, '', `/?item=${encodeURIComponent(ITEM_KEY)}`);
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));

    render(<App />);

    const nav = within(await screen.findByRole('navigation', { name: 'Pages' }));
    expect(nav.getByRole('link', { name: 'Chart' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      `/settings?item=${encodeURIComponent(ITEM_KEY)}`,
    );
  });

  it('while the items load, shows the header and a loading line', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );

    render(<App />);

    expect(screen.getByRole('link', { name: 'Top Right' })).toBeInTheDocument();
    expect(screen.getByText('Loading issues')).toBeInTheDocument();
  });

  it('if loading fails, shows the header and an alert that names the cause', async () => {
    stubFetch(() => Promise.resolve(Response.json({ error: 'GitHub is down' }, { status: 502 })));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Issues did not load: GitHub is down');
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
  });

  it('shows a change before the host confirms it, then the scores that the host returns', async () => {
    const user = userEvent.setup();
    const write = Promise.withResolvers<Response>();
    stubFetch((path) => (path === '/api/scores' ? write.promise : Promise.resolve(Response.json(ITEMS))));
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' }));
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' })).toBeChecked();

    write.resolve(
      Response.json({ itemKey: ITEM_KEY, scores: { urgency: { score: 'critical', by: 'author', at: AT } } }),
    );
    expect(await within(getGroup('Urgency')).findByRole('radio', { name: 'Critical' })).toBeChecked();
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
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'Medium' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('when the host writes the level to a label, shows the level that the returned label supplies', async () => {
    const user = userEvent.setup();
    stubFetch((path) => Promise.resolve(Response.json(path === '/api/scores' ? CRITICAL_BY_LABEL : ITEMS)));
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' }));

    expect(await screen.findByText('Label · urgency:critical')).toBeInTheDocument();
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' })).toBeChecked();
  });

  it('keeps a label that a write returned when a refresh started before the write answers after it', async () => {
    const user = userEvent.setup();
    const read = Promise.withResolvers<Response>();
    stubFetch((path) => {
      if (path === '/api/items/refresh') return read.promise;
      return Promise.resolve(Response.json(path === '/api/scores' ? CRITICAL_BY_LABEL : { ...ITEMS, isStale: true }));
    });
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' }));
    expect(await screen.findByText('Label · urgency:critical')).toBeInTheDocument();
    read.resolve(Response.json({ items: ITEMS.items, readAt: '2026-11-08T10:05:00.000Z' }));

    expect(await within(screen.getByRole('toolbar', { name: 'Issues' })).findByRole('time')).toHaveAttribute(
      'datetime',
      '2026-11-08T10:05:00.000Z',
    );
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'Critical' })).toBeChecked();
  });

  it('keeps an agent score before the host confirms it, and restores it with an alert when the write fails', async () => {
    const user = userEvent.setup();
    const keep = Promise.withResolvers<Response>();
    const agentScored = {
      ...ITEMS,
      scores: { [ITEM_KEY]: { urgency: { score: 'medium', by: 'agent' as const, at: AT } } },
    };
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
          urgency: { score: 'medium', by: 'agent' as const, at: AT },
          effort: { score: 3, by: 'agent' as const, at: AT },
        },
      },
    };
    stubFetch((path) =>
      path === '/api/scores' ? new Promise<Response>(() => {}) : Promise.resolve(Response.json(agentScored)),
    );
    render(<App />);

    await selectItem(user);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    await user.click(within(getGroup('Value')).getByRole('radio', { name: 'Should have' }));

    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
  });

  it('records the end of the visit when the page is hidden', async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));
    render(<App />);
    await screen.findByRole('button', { name: /^T\.12:/ });

    globalThis.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledWith('/api/visit');
  });
});

describe('setting the status', () => {
  const IN_PROGRESS_BY_LABEL: ItemsResponse = {
    ...ITEMS,
    items: ITEMS.items.map((item) => ({
      ...item,
      labels: ['feature', 'status:in-progress'],
      sourceStatus: 'in-progress',
    })),
  };
  const TO_DO_WRITTEN = { itemKey: ITEM_KEY, override: null, labels: ['feature'], sourceStatus: 'to-do' };

  it('shows To do on an issue labelled In progress before the host confirms it, and after', async () => {
    const user = userEvent.setup();
    const write = Promise.withResolvers<Response>();
    stubFetch((path) =>
      path === '/api/status' ? write.promise : Promise.resolve(Response.json(IN_PROGRESS_BY_LABEL)),
    );
    render(<App />);

    await selectItem(user);
    expect(within(getGroup('Status')).getByRole('radio', { name: 'In progress' })).toBeChecked();
    await user.click(within(getGroup('Status')).getByRole('radio', { name: 'To do' }));
    expect(within(getGroup('Status')).getByRole('radio', { name: 'To do' })).toBeChecked();

    write.resolve(Response.json(TO_DO_WRITTEN));
    await waitFor(() => expect(within(getGroup('Status')).getByRole('radio', { name: 'To do' })).toBeChecked());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('if the host refuses the write, returns the status to In progress and says so', async () => {
    const user = userEvent.setup();
    stubFetch((path) =>
      Promise.resolve(
        path === '/api/status'
          ? Response.json(
              { error: 'owner/repo has no label "status:in-progress"; create it at GitHub' },
              { status: 502 },
            )
          : Response.json(IN_PROGRESS_BY_LABEL),
      ),
    );
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Status')).getByRole('radio', { name: 'To do' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Status not saved: .*create it at GitHub/);
    expect(within(getGroup('Status')).getByRole('radio', { name: 'In progress' })).toBeChecked();
  });

  it('if the store fails after the write at GitHub, shows the status that the returned labels supply', async () => {
    const user = userEvent.setup();
    const { itemKey: _itemKey, override: _override, ...patch } = TO_DO_WRITTEN;
    stubFetch((path) =>
      Promise.resolve(
        path === '/api/status'
          ? Response.json(
              { error: 'the status changed at GitHub, but the stored status was not cleared', ...patch },
              {
                status: 500,
              },
            )
          : Response.json(IN_PROGRESS_BY_LABEL),
      ),
    );
    render(<App />);

    await selectItem(user);
    await user.click(within(getGroup('Status')).getByRole('radio', { name: 'To do' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Status not saved: the status changed at GitHub');
    expect(within(getGroup('Status')).getByRole('radio', { name: 'To do' })).toBeChecked();
  });
});

describe('refreshing the issues', () => {
  const RENAMED = 'Score every item';
  const REFRESHED = { items: [{ ...ITEMS.items[0], title: RENAMED }], readAt: '2026-11-08T10:05:00.000Z' };

  it('shows the read time and, when the issues are stale, replaces them with a fresh read', async () => {
    const read = Promise.withResolvers<Response>();
    stubFetch((path) =>
      path === '/api/items/refresh' ? read.promise : Promise.resolve(Response.json({ ...ITEMS, isStale: true })),
    );
    render(<App />);

    const toolbar = await screen.findByRole('toolbar', { name: 'Issues' });
    expect(toolbar).toHaveTextContent('Reading issues…');
    expect(screen.getAllByText('Score items').length).toBeGreaterThan(0);

    read.resolve(Response.json(REFRESHED));
    expect((await screen.findAllByText(RENAMED)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Score items')).not.toBeInTheDocument();
    expect(within(toolbar).getByRole('time')).toHaveAttribute('datetime', REFRESHED.readAt);
  });

  it('reads the issues again on Refresh, keeping the scores on the page', async () => {
    const user = userEvent.setup();
    stubFetch((path) => Promise.resolve(Response.json(path === '/api/items/refresh' ? REFRESHED : ITEMS)));
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Refresh' }));

    expect((await screen.findAllByText(RENAMED)).length).toBeGreaterThan(0);
    await selectItem(user);
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'Medium' })).toBeChecked();
  });

  it.each([
    {
      case: 'the host reports an error',
      response: () => Promise.resolve(Response.json({ error: 'GitHub responded 502 Bad Gateway.' }, { status: 502 })),
      expected: 'Issues not refreshed: GitHub responded 502 Bad Gateway.',
    },
    {
      case: 'the host does not respond',
      response: () => Promise.reject(new TypeError('Failed to fetch')),
      expected: 'Issues not refreshed: the host did not respond.',
    },
  ])('if the read fails because $case, keeps the last issues and says so', async ({ response, expected }) => {
    const user = userEvent.setup();
    stubFetch((path) => (path === '/api/items/refresh' ? response() : Promise.resolve(Response.json(ITEMS))));
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(new RegExp(`^${RegExp.escape(expected)}Dismiss$`));
    expect(screen.getAllByText('Score items').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-disabled', 'false');
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

    const other = await screen.findByRole('button', { name: /^T\.13:/ });
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
    const agentScored = {
      ...ITEMS,
      scores: { [ITEM_KEY]: { urgency: { score: 'medium', by: 'agent' as const, at: AT } } },
    };
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
  await user.click(await screen.findByRole('button', { name: /^T\.12:/ }));
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
