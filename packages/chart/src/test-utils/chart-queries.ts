import { screen, within } from '@testing-library/react';

/** Returns the radio group named `name` in the detail pane. */
export function getGroup(name: string): HTMLElement {
  return within(getPane()).getByRole('radiogroup', { name });
}

/** Returns the detail pane. */
export function getPane(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Item detail' });
}
