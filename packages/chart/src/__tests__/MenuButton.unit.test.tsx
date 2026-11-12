import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MenuButton, type MenuButtonGroup, type MenuButtonItem } from '../MenuButton.tsx';

describe(MenuButton, () => {
  it('shows each group as a group named by its visible heading, after the ungrouped item', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);

    await user.click(screen.getByRole('button', { name: 'Pick' }));

    const menu = screen.getByRole('menu', { name: 'Pick' });
    const groups = within(menu).getAllByRole('group');
    expect(groups.map((group) => group.textContent)).toEqual(['FruitsAppleBanana', 'VegetablesCarrot']);
    expect(within(menu).getByRole('group', { name: 'Fruits' })).toBeVisible();
    expect(
      within(within(menu).getByRole('group', { name: 'Vegetables' })).getByRole('menuitemcheckbox'),
    ).toHaveAccessibleName('Carrot');
    expect(
      within(menu)
        .getAllByRole('menuitemcheckbox')
        .map((item) => item.textContent),
    ).toEqual(['All', 'Apple', 'Banana', 'Carrot']);
  });

  it('moves across every item as one list, wrapping at the ends', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    await user.click(screen.getByRole('button', { name: 'Pick' }));

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Carrot' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'All' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Carrot' })).toHaveFocus();
  });

  it('stays open and keeps focus on a toggled item while closesOnChoose is false', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu closesOnChoose={false} />);
    await user.click(screen.getByRole('button', { name: 'Pick' }));

    await user.keyboard('{ArrowDown}{Enter}');
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Carrot' }));

    expect(screen.getByRole('menu', { name: 'Pick' })).toBeVisible();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Apple' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Carrot' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Carrot' })).toHaveFocus();
  });

  it('closes on Escape while closesOnChoose is false, returning focus to the button', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu closesOnChoose={false} />);
    await user.click(screen.getByRole('button', { name: 'Pick' }));
    await user.keyboard('{Enter}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick' })).toHaveFocus();
  });

  it('closes on a choice by default', async () => {
    const user = userEvent.setup();
    render(<StatefulMenu />);
    await user.click(screen.getByRole('button', { name: 'Pick' }));

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Banana' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

// region | Helpers
/** A menu of one ungrouped item and two groups, whose items toggle a checked set. */
function StatefulMenu({ closesOnChoose }: { closesOnChoose?: boolean }): ReactElement {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  function buildItem(label: string): MenuButtonItem {
    return {
      label,
      role: 'menuitemcheckbox',
      isChecked: checked.has(label),
      onChoose: () =>
        setChecked((current) => {
          const next = new Set(current);
          if (next.has(label)) next.delete(label);
          else next.add(label);
          return next;
        }),
    };
  }

  const groups: MenuButtonGroup[] = [
    { label: 'Fruits', items: [buildItem('Apple'), buildItem('Banana')] },
    { label: 'Vegetables', items: [buildItem('Carrot')] },
  ];
  return (
    <MenuButton
      items={[buildItem('All'), ...groups]}
      menuLabel="Pick"
      {...(closesOnChoose !== undefined && { closesOnChoose })}
    >
      Pick
    </MenuButton>
  );
}
// endregion | Helpers
