import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Opens the Repos menu, toggles each entry named in `labels` in order, and closes the menu with Escape. */
export async function chooseRepos(user: UserEvent, ...labels: string[]): Promise<void> {
  await user.click(getReposButton());
  for (const label of labels) await user.click(screen.getByRole('menuitemcheckbox', { name: label }));
  await user.keyboard('{Escape}');
}

/** Returns the Repos menu button, whose accessible name states the selection. */
export function getReposButton(): HTMLElement {
  return screen.getByRole('button', { name: /^Repos: / });
}
