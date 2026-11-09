import type { ReactElement } from 'react';

import { FilterBar, type FilterBarProps } from './FilterBar.tsx';
import type { ScopeMode } from './layout.ts';
import { MoreMenu } from './MoreMenu.tsx';
import { ReviewStrip } from './ReviewStrip.tsx';
import { Toggle } from './Toggle.tsx';
import type { Review } from './useReview.ts';

export interface ChartStripProps {
  /** The longest blocker chain's view: whether it is shown, and the chain's length in items, 0 without a chain. */
  chain: { isShown: boolean; length: number; onShownChange: (isShown: boolean) => void };
  filterBar: FilterBarProps;
  review: Review;
  showAllEdges: boolean;
  onShowAllEdgesChange: (showAllEdges: boolean) => void;
  scopeMode: ScopeMode;
  onScopeModeChange: (scopeMode: ScopeMode) => void;
  /** Where the host's Settings page is; without it, the strip does not link to Settings. */
  settingsHref: string | undefined;
}

/**
 * The strip above the chart: the filter, the review controls, the view toggles and the More menu, the shown chain's
 * status, and the link to Settings.
 */
export function ChartStrip({
  chain,
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
        <MoreMenu hasChain={chain.length > 0} isChainShown={chain.isShown} onChainShownChange={chain.onShownChange} />
      </div>
      {chain.isShown ? (
        <div aria-label="Longest chain" className="tr-chain" role="toolbar">
          <span aria-live="polite" className="tr-review-position">
            Longest chain · {chain.length} items
          </span>
          <button className="tr-review-button" onClick={() => chain.onShownChange(false)} type="button">
            End chain view
          </button>
        </div>
      ) : null}
      {settingsHref === undefined ? null : (
        <a className="tr-strip-link" href={settingsHref}>
          Settings
        </a>
      )}
    </div>
  );
}
