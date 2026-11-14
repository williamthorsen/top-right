import type { ReactElement } from 'react';

import { StatusIcon } from './StatusIcon.tsx';

/** Reports the outcome of a save: the host's refusal message, or undefined when the save succeeded. */
export type SaveSettings<T> = (value: T) => Promise<string | undefined>;

/** The outcome of a Settings form's last save, or undefined before the first. */
export type Outcome = { kind: 'error'; message: string } | { kind: 'saved' } | undefined;

/** Returns the outcome that an edit of the form leaves: a refusal stays, and "Saved" no longer holds. */
export function clearSaved(outcome: Outcome): Outcome {
  return outcome?.kind === 'saved' ? undefined : outcome;
}

/** The success note or the refusal of the last save, shown beside the form's buttons. */
export function OutcomeMessage({ outcome }: { outcome: Outcome }): ReactElement | null {
  if (outcome === undefined) return null;
  if (outcome.kind === 'saved') {
    return (
      <p className="tr-settings-outcome tr-settings-saved" role="status">
        <StatusIcon kind="success" />
        Saved
      </p>
    );
  }
  return (
    <p className="tr-settings-outcome tr-settings-error" role="alert">
      <StatusIcon kind="danger" />
      {outcome.message}
    </p>
  );
}
