import { type ReactElement, type ReactNode, useId } from 'react';

export interface SettingsSectionProps {
  heading: string;
  children: ReactNode;
}

/** A section of the Settings page that does not contain a form, named by its heading. */
export function SettingsSection({ heading, children }: SettingsSectionProps): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="tr-settings-section">
      <h2 id={headingId}>{heading}</h2>
      {children}
    </section>
  );
}
