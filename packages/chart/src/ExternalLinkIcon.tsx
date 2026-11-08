import type { ReactElement } from 'react';

/** The icon that marks a link to an item's source. */
export function ExternalLinkIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 12 12"
      width="12"
    >
      <path d="M5 2H2v8h8V7M7 1h4v4M11 1 5.5 6.5" />
    </svg>
  );
}
