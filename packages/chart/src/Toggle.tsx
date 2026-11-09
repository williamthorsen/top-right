import type { ReactElement, ReactNode } from 'react';

export interface ToggleProps {
  isPressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A button that switches a setting, showing a check while pressed that stays out of its accessible name. */
export function Toggle({ isPressed, onToggle, children }: ToggleProps): ReactElement {
  return (
    <button aria-pressed={isPressed} className="tr-toggle" onClick={onToggle} type="button">
      {isPressed ? <span aria-hidden="true">✓</span> : null}
      {children}
    </button>
  );
}
