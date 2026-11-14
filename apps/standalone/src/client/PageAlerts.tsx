import { StatusIcon } from '@top-right/chart';
import { type AbbreviationClash, describeAbbreviationClash } from '@top-right/model';
import type { ReactElement } from 'react';

import type { Failure } from './request-failure.ts';

export interface PageAlertsProps {
  clashes: readonly AbbreviationClash[];
  /** The Settings page, where the author resolves a clash. */
  settingsHref: string;
  failure: Failure | undefined;
  onDismiss: () => void;
}

/** The chart page's alerts: a warning for each abbreviation clash, and the last failed request until it is dismissed. */
export function PageAlerts({ clashes, settingsHref, failure, onDismiss }: PageAlertsProps): ReactElement {
  return (
    <>
      {clashes.map((clash) => (
        <div className="host-alert host-alert-warning" key={clash.abbreviation} role="alert">
          <StatusIcon kind="warning" />
          <span className="host-alert-text">{describeAbbreviationClash(clash)}</span>
          <a href={settingsHref}>Settings</a>
        </div>
      ))}
      {failure === undefined ? null : (
        <div className="host-alert host-alert-failure" role="alert">
          <StatusIcon kind="danger" />
          <span className="host-alert-text">{failure.message}</span>
          <button className="host-button" onClick={onDismiss} type="button">
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
