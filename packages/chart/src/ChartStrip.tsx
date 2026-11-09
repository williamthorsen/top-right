import type { ReactElement } from 'react';

import { FilterBar, type FilterBarProps } from './FilterBar.tsx';
import type { ScopeMode } from './layout.ts';
import { ReviewStrip } from './ReviewStrip.tsx';
import { Toggle } from './Toggle.tsx';
import type { Review } from './useReview.ts';

export interface ChartStripProps {
  filterBar: FilterBarProps;
  review: Review;
  showAllEdges: boolean;
  onShowAllEdgesChange: (showAllEdges: boolean) => void;
  scopeMode: ScopeMode;
  onScopeModeChange: (scopeMode: ScopeMode) => void;
  /** Where the host's Settings page is; without it, the strip does not link to Settings. */
  settingsHref: string | undefined;
}

/** The strip above the chart: the filter, the review controls, the view toggles, and the link to Settings. */
export function ChartStrip({
  filterBar,
  review,
  showAllEdges,
  onShowAllEdgesChange,
  scopeMode,
  onScopeModeChange,
  settingsHref,
}: ChartStripProps): ReactElement {
  return (
    <div className="tr-strip">
      <FilterBar {...filterBar} />
      <ReviewStrip
        counts={{ agent: review.queues.agent.length, unscored: review.queues.unscored.length }}
        onEnd={review.end}
        onSkip={review.skip}
        onStart={review.start}
        running={review.kind === undefined ? undefined : { kind: review.kind, position: review.position }}
      />
      <div className="tr-view-toggles">
        <Toggle isPressed={showAllEdges} onToggle={() => onShowAllEdgesChange(!showAllEdges)}>
          All edges
        </Toggle>
        <Toggle
          isPressed={scopeMode === 'remaining'}
          onToggle={() => onScopeModeChange(scopeMode === 'remaining' ? 'original' : 'remaining')}
        >
          Remaining scope
        </Toggle>
      </div>
      {settingsHref === undefined ? null : (
        <a className="tr-strip-link" href={settingsHref}>
          Settings
        </a>
      )}
    </div>
  );
}
