import type { ReactElement } from 'react';

/** The kind of outcome that a message reports. */
export type StatusKind = 'danger' | 'success' | 'warning';

/** The icon that marks a message as a success, a warning, or a failure, drawn in the text's colour. */
export function StatusIcon({ kind }: { kind: StatusKind }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="tr-status-icon"
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="1em"
    >
      {kind === 'success' ? <path d="M3 8.5 6.5 12 13 4.5" /> : null}
      {kind === 'warning' ? <path d="M8 1.75 15 14H1ZM8 6.5v3.5M8 12v.01" /> : null}
      {kind === 'danger' ? (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5V9M8 11.5v.01" />
        </>
      ) : null}
    </svg>
  );
}
