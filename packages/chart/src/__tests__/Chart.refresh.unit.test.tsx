import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Chart } from '../Chart.tsx';
import type { ChartRefresh } from '../RefreshControl.tsx';
import { buildItem } from '../test-utils/chart-fixtures.tsx';

const ITEMS = [buildItem({ number: 1 })];
const MINUTE_MS = 60_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('Chart refresh', () => {
  it('shows neither the read time nor Refresh without the prop', () => {
    render(<Chart abbreviations={{}} items={ITEMS} />);

    expect(screen.queryByRole('toolbar', { name: 'Issues' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it.each([
    [30 * 1000, 'Issues read under a minute ago'],
    [3 * MINUTE_MS + 59 * 1000, 'Issues read 3 minutes ago'],
    [2 * 60 * MINUTE_MS, 'Issues read 2 hours ago'],
    [3 * 24 * 60 * MINUTE_MS, 'Issues read 3 days ago'],
    [-5 * 1000, 'Issues read under a minute ago'],
  ])('shows a read %i ms ago as "%s"', (elapsedMs, text) => {
    renderWithRefresh({ readAt: new Date(Date.now() - elapsedMs).toISOString() });

    expect(screen.getByRole('toolbar', { name: 'Issues' })).toHaveTextContent(`${text}Refresh`);
  });

  it('reports a press of Refresh', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderWithRefresh({ onRefresh });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('while a read runs, says so and ignores Refresh', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderWithRefresh({ isRefreshing: true, onRefresh });
    const button = screen.getByRole('button', { name: 'Refresh' });

    await user.click(button);

    expect(screen.getByRole('toolbar', { name: 'Issues' })).toHaveTextContent('Reading issues…');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('advances the read time as minutes pass', () => {
    vi.useFakeTimers();
    renderWithRefresh({ readAt: new Date(Date.now()).toISOString() });

    act(() => {
      vi.advanceTimersByTime(2 * MINUTE_MS);
    });

    expect(screen.getByRole('toolbar', { name: 'Issues' })).toHaveTextContent('Issues read 2 minutes ago');
  });
});

// region | Helpers
function renderWithRefresh(refresh: Partial<ChartRefresh>): void {
  render(
    <Chart
      abbreviations={{}}
      items={ITEMS}
      refresh={{ readAt: new Date().toISOString(), isRefreshing: false, onRefresh: () => {}, ...refresh }}
    />,
  );
}
// endregion | Helpers
