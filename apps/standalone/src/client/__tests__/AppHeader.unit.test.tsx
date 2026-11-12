// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppHeader } from '../AppHeader.tsx';

import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

describe(AppHeader, () => {
  it('links the product name to the chart', () => {
    render(<AppHeader chartHref="/?item=x" current="settings" settingsHref="/settings?item=x" />);

    expect(screen.getByRole('link', { name: 'Top Right' })).toHaveAttribute('href', '/?item=x');
  });

  it('links to each page and marks the current one', () => {
    render(<AppHeader chartHref="/?item=x" current="settings" settingsHref="/settings?item=x" />);

    const nav = within(screen.getByRole('navigation', { name: 'Pages' }));
    expect(nav.getByRole('link', { name: 'Chart' })).toHaveAttribute('href', '/?item=x');
    expect(nav.getByRole('link', { name: 'Chart' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings?item=x');
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });
});
