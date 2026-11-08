import type { ReviewQueueKind } from '@top-right/model';
import type { ReactElement } from 'react';

export interface ReviewStripProps {
  /** The number of items in each queue. */
  counts: Readonly<Record<ReviewQueueKind, number>>;
  /** The running review, with the selected item's 0-based position in its queue, or undefined outside the queue. */
  running: { kind: ReviewQueueKind; position: number | undefined } | undefined;
  onStart: (kind: ReviewQueueKind) => void;
  onSkip: () => void;
  onEnd: () => void;
}

const QUEUE_NAMES: Readonly<Record<ReviewQueueKind, string>> = { agent: 'Agent-scored', unscored: 'Unscored' };

/** The review toolbar at the chart's top edge: a start button per queue, or the running queue's position and steps. */
export function ReviewStrip({ counts, running, onStart, onSkip, onEnd }: ReviewStripProps): ReactElement {
  if (running) {
    const total = counts[running.kind];
    const position = running.position === undefined ? '–' : String(running.position + 1);
    return (
      <div aria-label="Review" className="tr-review" role="toolbar">
        <span aria-live="polite" className="tr-review-position">
          {QUEUE_NAMES[running.kind]} · {position} of {total}
        </span>
        <button className="tr-review-button" onClick={onSkip} type="button">
          Skip
        </button>
        <button className="tr-review-button" onClick={onEnd} type="button">
          End review
        </button>
      </div>
    );
  }
  return (
    <div aria-label="Review" className="tr-review" role="toolbar">
      <button className="tr-review-button" disabled={counts.agent === 0} onClick={() => onStart('agent')} type="button">
        Review agent scores ({counts.agent})
      </button>
      <button
        className="tr-review-button"
        disabled={counts.unscored === 0}
        onClick={() => onStart('unscored')}
        type="button"
      >
        Review unscored ({counts.unscored})
      </button>
    </div>
  );
}
