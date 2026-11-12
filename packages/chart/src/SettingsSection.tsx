import { type ReactElement, type ReactNode, useId } from 'react';

export interface SettingsSectionProps {
  heading: string;
  /** One line under the heading, styled as the forms' hints are. */
  hint?: ReactNode;
  children: ReactNode;
}

/** A section of the Settings page that does not contain a form, named by its heading. */
export function SettingsSection({ heading, hint, children }: SettingsSectionProps): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="tr-settings-section">
      <h2 id={headingId}>{heading}</h2>
      {hint === undefined ? null : <p className="tr-settings-hint">{hint}</p>}
      {children}
    </section>
  );
}
