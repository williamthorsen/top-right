import type { ReactElement, ReactNode } from 'react';

export interface FilterChipProps {
  isPressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A filter chip: a pill-shaped toggle button that shows a check while on, kept out of its accessible name. */
export function FilterChip({ isPressed, onToggle, children }: FilterChipProps): ReactElement {
  return (
    <button aria-pressed={isPressed} className="tr-filter-chip" onClick={onToggle} type="button">
      {isPressed ? <span aria-hidden="true">✓</span> : null}
      {children}
    </button>
  );
}
