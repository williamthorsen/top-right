// @vitest-environment jsdom
// eslint-disable-next-line testing-library/no-manual-cleanup -- Vitest runs without globals, so Testing Library cannot register its own cleanup.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.tsx';

import '@testing-library/jest-dom/vitest';

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
});
