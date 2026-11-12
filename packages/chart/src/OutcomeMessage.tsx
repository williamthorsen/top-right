import type { ReactElement } from 'react';

/** Reports the outcome of a save: the host's refusal message, or undefined when the save succeeded. */
export type SaveSettings<T> = (value: T) => Promise<string | undefined>;

/** The outcome of a Settings form's last save, or undefined before the first. */
export type Outcome = { kind: 'error'; message: string } | { kind: 'saved' } | undefined;

/** The success note or the refusal of the last save. */
export function OutcomeMessage({ outcome }: { outcome: Outcome }): ReactElement | null {
  if (outcome === undefined) return null;
  if (outcome.kind === 'saved') {
    return (
      <p className="tr-settings-saved" role="status">
        Saved.
      </p>
    );
  }
  return (
    <p className="tr-settings-error" role="alert">
      {outcome.message}
    </p>
  );
}
