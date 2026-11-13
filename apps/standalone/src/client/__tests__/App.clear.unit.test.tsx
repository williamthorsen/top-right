// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ItemsResponse } from '#src/shared/items-response.ts';

import { App } from '../App.tsx';
import { setUpAppEnvironment } from '../test-utils/app-environment.ts';
import { AT, ITEM_KEY, ITEMS } from '../test-utils/app-fixtures.ts';
import { stubFetch } from '../test-utils/fetch-stub.ts';

setUpAppEnvironment();

const [ITEM] = ITEMS.items;
// The item's urgency comes from its label, and its progress from the store.
const LABELLED: ItemsResponse = {
  ...ITEMS,
  items: ITEM ? [{ ...ITEM, labels: ['feature', 'urgency:high'] }] : [],
  scores: { [ITEM_KEY]: { progress: { score: 0.4, by: 'author', at: AT } } },
};

describe('clearing a score in the app', () => {
  it('shows the score cleared before the host answers, and posts the cleared field', async () => {
    const user = userEvent.setup();
    const answer = Promise.withResolvers<Response>();
    stubFetch((path) => (path === '/api/scores/clear' ? answer.promise : Promise.resolve(Response.json(LABELLED))));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^T\.12:/ }));

    await user.click(screen.getByRole('button', { name: 'Clear urgency' }));

    expect(within(getGroup('Urgency')).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(readPostedBody('/api/scores/clear')).toStrictEqual({ itemKey: ITEM_KEY, fields: ['urgency'] });
    answer.resolve(Response.json({ itemKey: ITEM_KEY, scores: LABELLED.scores[ITEM_KEY], labels: ['feature'] }));
    expect(await screen.findByRole('slider', { name: 'Progress' })).toHaveValue('40');
    expect(within(getGroup('Urgency')).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('if the host refuses the clear, restores the label score and says so', async () => {
    const user = userEvent.setup();
    stubFetch((path) =>
      Promise.resolve(
        path === '/api/scores/clear'
          ? Response.json({ error: 'GitHub refused the label change' }, { status: 502 })
          : Response.json(LABELLED),
      ),
    );
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^T\.12:/ }));

    await user.click(screen.getByRole('button', { name: 'Clear urgency' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Score not cleared: GitHub refused the label change. Try again.',
    );
    expect(within(getGroup('Urgency')).getByRole('radio', { name: 'High' })).toBeChecked();
  });
});

// region | Helpers
function getGroup(name: string): HTMLElement {
  return screen.getByRole('radiogroup', { name });
}

/** Returns the JSON body of the last POST to `path`. */
function readPostedBody(path: string): unknown {
  const call = vi.mocked(fetch).mock.calls.findLast(([input]) => input === path);
  return typeof call?.[1]?.body === 'string' ? JSON.parse(call[1].body) : undefined;
}
// endregion | Helpers
