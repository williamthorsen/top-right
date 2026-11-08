import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactElement, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { clampSplit, Divider } from '../Divider.tsx';

describe(clampSplit, () => {
  it('keeps each pane at least 120 px high', () => {
    expect(clampSplit(5, 600)).toBe(20);
    expect(clampSplit(95, 600)).toBe(80);
    expect(clampSplit(60, 600)).toBe(60);
  });

  it('splits evenly when the container cannot hold both floors', () => {
    expect(clampSplit(70, 200)).toBe(50);
  });
});

describe(Divider, () => {
  it('moves by 5 % on the arrow keys and to the limits on Home and End', async () => {
    const user = userEvent.setup();
    renderDivider(600);
    const divider = screen.getByRole('separator', { name: 'Chart and table' });
    divider.focus();

    await user.keyboard('{ArrowDown}');
    expectSplit(65);

    await user.keyboard('{ArrowUp}{ArrowUp}');
    expectSplit(55);

    await user.keyboard('{End}');
    expectSplit(80);

    await user.keyboard('{Home}');
    expectSplit(20);
  });

  it('follows a captured pointer, clamped to the limits', () => {
    renderDivider(600);
    const divider = screen.getByRole('separator', { name: 'Chart and table' });
    divider.setPointerCapture = () => {};
    divider.hasPointerCapture = () => true;

    fireEvent.pointerDown(divider, { pointerId: 1 });
    fireEvent.pointerMove(divider, { pointerId: 1, clientY: 150 });
    expectSplit(25);

    fireEvent.pointerMove(divider, { pointerId: 1, clientY: 590 });
    expectSplit(80);
  });
});

// region | Helpers
/** Asserts the split that the divider reports as its value. */
function expectSplit(now: number): void {
  expect(screen.getByRole('separator', { name: 'Chart and table', value: { now } })).toBeInTheDocument();
}

/** Renders the divider in a container that reports `height` px, at a 60 % split. */
function renderDivider(height: number): void {
  function Harness(): ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState(60);
    return (
      <div
        ref={(element) => {
          containerRef.current = element;
          if (element) element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 800, height });
        }}
      >
        <Divider containerRef={containerRef} label="Chart and table" onChange={setValue} value={value} />
      </div>
    );
  }
  render(<Harness />);
}
// endregion | Helpers
