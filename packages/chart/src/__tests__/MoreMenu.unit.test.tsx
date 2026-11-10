import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MoreMenu } from '../MoreMenu.tsx';

describe(MoreMenu, () => {
  it('opens on a click, flips its caret, and focuses the chain item', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    const button = screen.getByRole('button', { name: 'More' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('▾');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveTextContent('▴');
    expect(button).toHaveAccessibleName('More');
    expect(screen.getByRole('menu', { name: 'More' })).toBeVisible();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' })).toHaveFocus();
  });

  it.each(['{ArrowDown}', '{ArrowUp}', '{Enter}', ' '])('opens from the button on %s', async (key) => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    screen.getByRole('button', { name: 'More' }).focus();

    await user.keyboard(key);

    expect(screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' })).toHaveFocus();
  });

  it('keeps focus on the one item as arrow keys, Home, and End move', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const item = screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' });

    await user.keyboard('{ArrowDown}{ArrowUp}{End}{Home}');

    expect(item).toHaveFocus();
    expect(item).toHaveAttribute('tabindex', '0');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    const button = screen.getByRole('button', { name: 'More' });
    await user.click(button);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on a press outside the menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <StatefulMenu />
        <p>Elsewhere</p>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'More' }));

    await user.click(screen.getByText('Elsewhere'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles the chain view on activation, closing the menu and checking the item', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    const button = screen.getByRole('button', { name: 'More' });
    await user.click(button);
    expect(screen.getByRole('menuitemcheckbox')).not.toBeChecked();

    await user.keyboard('{Enter}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.click(button);
    const item = screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' });
    expect(item).toBeChecked();

    await user.click(item);

    await user.click(button);
    expect(screen.getByRole('menuitemcheckbox')).not.toBeChecked();
  });

  it('does not report a choice of the disabled item, which stays focusable', async () => {
    const user = userEvent.setup();
    const onChainShownChange = vi.fn<(isChainShown: boolean) => void>();
    render(<MoreMenu hasChain={false} isChainShown={false} onChainShownChange={onChainShownChange} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const item = screen.getByRole('menuitemcheckbox', { name: 'Longest blocker chain' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.click(item);

    expect(onChainShownChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeVisible();
  });
});

// region | Helpers
/** Renders a menu that holds its own chain state, with a chain available. */
function StatefulMenu(): ReactElement {
  const [isChainShown, setIsChainShown] = useState(false);
  return <MoreMenu hasChain isChainShown={isChainShown} onChainShownChange={setIsChainShown} />;
}
// endregion | Helpers
