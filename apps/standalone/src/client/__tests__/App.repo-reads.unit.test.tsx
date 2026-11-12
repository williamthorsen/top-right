// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';
import { setUpAppEnvironment } from '../test-utils/app-environment.ts';
import { AT, ITEM_KEY, ITEMS, REPO } from '../test-utils/app-fixtures.ts';
import { listPostedRepos, stubFetch } from '../test-utils/fetch-stub.ts';

setUpAppEnvironment();

describe('reading the shown repositories', () => {
  const OTHER = 'williamthorsen/toolbelt';
  const OTHER_ITEM = {
    ...ITEMS.items[0],
    repo: OTHER,
    title: 'Sharpen the tools',
    url: 'https://github.com/williamthorsen/toolbelt/issues/12',
  };
  const WITH_DEFAULT: ItemsResponse = {
    ...ITEMS,
    abbreviations: { [REPO]: 'T', [OTHER]: 'B' },
    collections: [{ id: 'c1', name: 'Product', repos: [REPO] }],
    defaultCollectionId: 'c1',
  };

  /** Returns a read answer of `item` alone, whose read the host judged stale or fresh. */
  function readOf(item: typeof OTHER_ITEM, isStale: boolean) {
    return { items: [item], reads: { [item.repo]: { readAt: AT, isStale } } };
  }

  it("asks the host for the URL's item with the first load", async () => {
    globalThis.history.replaceState(null, '', `/?item=${encodeURIComponent(ITEM_KEY)}`);
    stubFetch(() => Promise.resolve(Response.json(ITEMS)));
    render(<App />);

    await screen.findByRole('complementary', { name: 'Item detail' });

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(`/api/items?item=${encodeURIComponent(ITEM_KEY)}`);
  });

  it('reads a repository when the chart shows it, and again each time that the chart shows it again', async () => {
    const user = userEvent.setup();
    stubFetch((path) =>
      Promise.resolve(Response.json(path === '/api/items/read' ? readOf(OTHER_ITEM, false) : WITH_DEFAULT)),
    );
    render(<App />);
    await screen.findByRole('button', { name: 'Repos: Product' });
    expect(listPostedRepos('/api/items/read')).toStrictEqual([]);

    await chooseRepos(user, 'toolbelt (B)');
    expect((await screen.findAllByText('Sharpen the tools')).length).toBeGreaterThan(0);
    await chooseRepos(user, 'toolbelt (B)');
    await chooseRepos(user, 'toolbelt (B)');

    await waitFor(() => expect(listPostedRepos('/api/items/read')).toStrictEqual([[OTHER], [OTHER]]));
    expect(listPostedRepos('/api/items/refresh')).toStrictEqual([]);
  });

  it('refreshes a newly shown repository whose read the host answers as stale', async () => {
    const user = userEvent.setup();
    stubFetch((path) => {
      if (path === '/api/items/read') return Promise.resolve(Response.json(readOf(OTHER_ITEM, true)));
      if (path === '/api/items/refresh') return Promise.resolve(Response.json(readOf(OTHER_ITEM, false)));
      return Promise.resolve(Response.json(WITH_DEFAULT));
    });
    render(<App />);
    await screen.findByRole('button', { name: 'Repos: Product' });

    await chooseRepos(user, 'toolbelt (B)');

    await waitFor(() => expect(listPostedRepos('/api/items/refresh')).toStrictEqual([[OTHER]]));
  });

  it('refreshes only the shown repositories, and shows the oldest of their reads', async () => {
    const user = userEvent.setup();
    const withOlderHidden: ItemsResponse = {
      ...WITH_DEFAULT,
      reads: {
        [REPO]: { readAt: AT, isStale: false },
        [OTHER]: { readAt: '2026-11-08T09:00:00.000Z', isStale: false },
      },
    };
    stubFetch((path) =>
      Promise.resolve(
        Response.json(
          path === '/api/items/refresh'
            ? { items: ITEMS.items, reads: { [REPO]: { readAt: AT, isStale: false } } }
            : withOlderHidden,
        ),
      ),
    );
    render(<App />);

    const toolbar = await screen.findByRole('toolbar', { name: 'Issues' });
    // The chart reports the shown repositories after its first render, so the strip settles on their reads after it.
    await waitFor(() => expect(within(toolbar).getByRole('time')).toHaveAttribute('datetime', AT));
    await user.click(within(toolbar).getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(listPostedRepos('/api/items/refresh')).toStrictEqual([[REPO]]));
  });
});

// region | Helpers
/** Opens the Repos menu, toggles each entry named in `labels` in order, and closes the menu with Escape. */
async function chooseRepos(user: ReturnType<typeof userEvent.setup>, ...labels: string[]): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^Repos: / }));
  for (const label of labels) await user.click(screen.getByRole('menuitemcheckbox', { name: label }));
  await user.keyboard('{Escape}');
}
// endregion | Helpers
