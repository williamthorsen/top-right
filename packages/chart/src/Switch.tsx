import type { ReactElement, ReactNode } from 'react';

export interface SwitchProps {
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
  children: ReactNode;
}

/** A switch that turns one behaviour on or off, drawn as a track whose thumb sits right while on, before its label. */
export function Switch({ isChecked, onChange, children }: SwitchProps): ReactElement {
  return (
    <button
      aria-checked={isChecked}
      className="tr-switch"
      onClick={() => onChange(!isChecked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="tr-switch-track">
        <span className="tr-switch-thumb" />
      </span>
      {children}
    </button>
  );
}
