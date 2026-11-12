// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DEFAULT_SCORE_LABEL_MAPPING } from '@top-right/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SettingsResponse } from '#src/shared/settings.ts';

import { SettingsPage } from '../SettingsPage.tsx';

import '@testing-library/jest-dom/vitest';

const SETTINGS: SettingsResponse = {
  repos: ['w/codeassembly', 'w/top-right'],
  configPath: '/home/author/top-right/apps/standalone/config.local.json',
  abbreviations: { 'w/codeassembly': 'ca' },
  workTypeMapping: null,
  scoreLabelMapping: null,
  collections: [],
  defaultCollectionId: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, '', '/');
});

describe(SettingsPage, () => {
  it('while the settings load, shows the header and a loading line', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );

    render(<SettingsPage />);

    expect(screen.getByRole('link', { name: 'Top Right' })).toBeInTheDocument();
    expect(screen.getByText('Loading settings')).toBeInTheDocument();
  });

  it('if loading fails, shows the header and one alert line that names the cause', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ error: 'disk full' }, { status: 500 }))),
    );

    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Settings did not load: disk full');
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
  });

  it('marks Settings as the current page and links the header to the chart with the selected item', async () => {
    globalThis.history.replaceState(null, '', '/settings?item=w%2Ftop-right%2312');
    void stubFetch(() => Promise.resolve(Response.json(SETTINGS)));

    render(<SettingsPage />);

    const nav = within(await screen.findByRole('navigation', { name: 'Pages' }));
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Chart' })).toHaveAttribute('href', '/?item=w%2Ftop-right%2312');
    expect(screen.getByRole('link', { name: 'Top Right' })).toHaveAttribute('href', '/?item=w%2Ftop-right%2312');
  });

  it('lists the repositories and says that they are edited in the config file that the host read', async () => {
    void stubFetch(() => Promise.resolve(Response.json(SETTINGS)));

    render(<SettingsPage />);

    const section = await screen.findByRole('region', { name: 'Repositories' });
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toStrictEqual(SETTINGS.repos);
    expect(section).toHaveTextContent(`Edit repos in ${SETTINGS.configPath}, then restart the host.`);
  });

  it('posts a saved section and shows the refusal that the host returns', async () => {
    const fetch = stubFetch((path) =>
      Promise.resolve(
        path === '/api/abbreviations'
          ? Response.json({ error: '"t" is used by w/a and w/b. Give each its own abbreviation.' }, { status: 400 })
          : Response.json(SETTINGS),
      ),
    );
    render(<SettingsPage />);
    const section = await screen.findByRole('form', { name: 'Repo abbreviations' });

    await userEvent.setup().click(within(section).getByRole('button', { name: 'Save' }));

    expect(fetch).toHaveBeenCalledWith('/api/abbreviations', expect.objectContaining({ method: 'POST' }));
    expect(within(section).getByRole('alert')).toHaveTextContent(
      'Not saved: "t" is used by w/a and w/b. Give each its own abbreviation.',
    );
  });

  it('restores the default mapping by posting a null mapping', async () => {
    const fetch = stubFetch((path) =>
      Promise.resolve(Response.json(path === '/api/work-type-mapping' ? { mapping: null } : SETTINGS)),
    );
    render(<SettingsPage />);
    const section = await screen.findByRole('form', { name: 'Work types' });

    await userEvent.setup().click(within(section).getByRole('button', { name: 'Restore defaults' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/work-type-mapping',
      expect.objectContaining({ body: JSON.stringify({ mapping: null }) }),
    );
    expect(await within(section).findByRole('status')).toHaveTextContent('Saved.');
  });

  it('saves the score-label mapping through its own route', async () => {
    const fetch = stubFetch((path) =>
      Promise.resolve(
        Response.json(path === '/api/score-label-mapping' ? { mapping: DEFAULT_SCORE_LABEL_MAPPING } : SETTINGS),
      ),
    );
    render(<SettingsPage />);
    const section = await screen.findByRole('form', { name: 'Score labels' });

    await userEvent.setup().click(within(section).getByRole('button', { name: 'Save' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/score-label-mapping',
      expect.objectContaining({ body: JSON.stringify({ mapping: DEFAULT_SCORE_LABEL_MAPPING }) }),
    );
    expect(await within(section).findByRole('status')).toHaveTextContent('Saved.');
  });

  it('saves the collections through their own route, posting a missing default as null', async () => {
    const saved = { collections: [{ id: 'c1', name: 'Core', repos: ['w/top-right'] }], defaultCollectionId: null };
    const fetch = stubFetch((path) =>
      Promise.resolve(Response.json(path === '/api/collections' ? saved : { ...SETTINGS, ...saved })),
    );
    render(<SettingsPage />);
    const section = await screen.findByRole('form', { name: 'Collections' });

    await userEvent.setup().click(within(section).getByRole('button', { name: 'Save' }));

    expect(fetch).toHaveBeenCalledWith('/api/collections', expect.objectContaining({ body: JSON.stringify(saved) }));
    expect(await within(section).findByRole('status')).toHaveTextContent('Saved.');
  });
});

// region | Helpers
function stubFetch(respond: (path: string) => Promise<Response>) {
  const fetch = vi.fn((input: string, _init?: RequestInit) => respond(input));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
// endregion | Helpers
