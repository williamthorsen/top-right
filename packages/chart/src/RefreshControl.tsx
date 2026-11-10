import { type ReactElement, useEffect, useState } from 'react';

/** The host's read of the items: when it started, whether a read is running, and how to start one. */
export interface ChartRefresh {
  /** When the read of the shown items started, as an ISO timestamp. */
  readAt: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** The strip's toolbar that shows how old the items are, with a button that reads them again. */
export function RefreshControl({ readAt, isRefreshing, onRefresh }: ChartRefresh): ReactElement {
  // `now` advances once a minute, so a fresh read can be newer than it; `formatElapsed` reads that as under a minute.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div aria-label="Issues" className="tr-issues" role="toolbar">
      <span className="tr-issues-status">
        {isRefreshing ? (
          'Reading issues…'
        ) : (
          <>
            Issues read{' '}
            <time dateTime={readAt} title={new Date(readAt).toLocaleString()}>
              {formatElapsed(now - Date.parse(readAt))}
            </time>
          </>
        )}
      </span>
      <button
        aria-disabled={isRefreshing}
        className="tr-review-button"
        onClick={() => {
          if (!isRefreshing) onRefresh();
        }}
        type="button"
      >
        Refresh
      </button>
    </div>
  );
}

// region | Helpers
/** Returns how long ago a moment `elapsedMs` back was, in whole minutes, hours, or days; a moment ahead reads as now. */
function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < MINUTE_MS) return 'under a minute ago';
  if (elapsedMs < HOUR_MS) return relativeTime.format(-Math.floor(elapsedMs / MINUTE_MS), 'minute');
  if (elapsedMs < DAY_MS) return relativeTime.format(-Math.floor(elapsedMs / HOUR_MS), 'hour');
  return relativeTime.format(-Math.floor(elapsedMs / DAY_MS), 'day');
}
// endregion | Helpers
