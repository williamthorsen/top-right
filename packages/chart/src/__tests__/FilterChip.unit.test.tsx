import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { FilterChip } from '../FilterChip.tsx';

describe(FilterChip, () => {
  it('keeps the same accessible name when pressed and shows the check only while pressed', async () => {
    const user = userEvent.setup();
    render(<StatefulFilterChip />);
    const chip = screen.getByRole('button', { name: 'To do 3' });
    expect(chip).not.toBePressed();
    expect(chip).not.toHaveTextContent('✓');

    await user.click(chip);

    expect(chip).toBePressed();
    expect(chip).toHaveAccessibleName('To do 3');
    expect(chip).toHaveTextContent('✓');

    await user.click(chip);

    expect(chip).not.toBePressed();
    expect(chip).not.toHaveTextContent('✓');
  });
});

// region | Helpers
/** Renders a filter chip that holds its own pressed state. */
function StatefulFilterChip(): ReactElement {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <FilterChip isPressed={isPressed} onToggle={() => setIsPressed((current) => !current)}>
      To do <span>3</span>
    </FilterChip>
  );
}
// endregion | Helpers
