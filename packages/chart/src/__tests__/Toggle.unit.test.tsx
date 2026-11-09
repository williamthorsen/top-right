import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Toggle } from '../Toggle.tsx';

describe(Toggle, () => {
  it('keeps the same accessible name when pressed and shows the check only while pressed', async () => {
    const user = userEvent.setup();
    render(<StatefulToggle />);
    const toggle = screen.getByRole('button', { name: 'All edges' });
    expect(toggle).not.toBePressed();
    expect(toggle).not.toHaveTextContent('✓');

    await user.click(toggle);

    expect(toggle).toBePressed();
    expect(toggle).toHaveAccessibleName('All edges');
    expect(toggle).toHaveTextContent('✓');

    await user.click(toggle);

    expect(toggle).not.toBePressed();
    expect(toggle).not.toHaveTextContent('✓');
  });
});

// region | Helpers
/** Renders a toggle that holds its own pressed state. */
function StatefulToggle(): ReactElement {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <Toggle isPressed={isPressed} onToggle={() => setIsPressed((current) => !current)}>
      All edges
    </Toggle>
  );
}
// endregion | Helpers
