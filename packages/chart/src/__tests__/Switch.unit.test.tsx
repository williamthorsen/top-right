import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Switch } from '../Switch.tsx';

describe(Switch, () => {
  it('exposes a switch whose checked state follows each press and whose name stays the same', async () => {
    const user = userEvent.setup();
    render(<StatefulSwitch />);
    const control = screen.getByRole('switch', { name: 'All edges' });
    expect(control).not.toBeChecked();

    await user.click(control);

    expect(control).toBeChecked();
    expect(control).toHaveAccessibleName('All edges');

    await user.keyboard(' ');

    expect(control).not.toBeChecked();
  });
});

// region | Helpers
/** Renders a switch that holds its own checked state. */
function StatefulSwitch(): ReactElement {
  const [isChecked, setIsChecked] = useState(false);
  return (
    <Switch isChecked={isChecked} onChange={setIsChecked}>
      All edges
    </Switch>
  );
}
// endregion | Helpers
