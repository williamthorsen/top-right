import type { ReactElement } from 'react';

import { FilterBar, type FilterBarProps } from './FilterBar.tsx';
import type { ScopeMode } from './layout.ts';
import { MoreMenu } from './MoreMenu.tsx';
import { type ChartRefresh, RefreshControl } from './RefreshControl.tsx';
import { ReviewStrip } from './ReviewStrip.tsx';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { Switch } from './Switch.tsx';
import type { ChainView } from './useChainView.ts';
import type { Review } from './useReview.ts';
import type { ZoomState } from './useZoom.ts';
import { ZoomControl } from './ZoomControl.tsx';

export interface ChartStripProps {
  chainView: ChainView;
  filterBar: FilterBarProps;
  /** The host's read of the items; without it, the strip shows neither the read time nor Refresh. */
  refresh: ChartRefresh | undefined;
  review: Review;
  showAllEdges: boolean;
  onShowAllEdgesChange: (showAllEdges: boolean) => void;
  scopeMode: ScopeMode;
  onScopeModeChange: (scopeMode: ScopeMode) => void;
  /** Where the host's Settings page is; without it, the strip does not link to Settings. */
  settingsHref: string | undefined;
  zoom: ZoomState;
}

/** The scope modes that the strip offers, in display order. */
const SCOPE_OPTIONS: ReadonlyArray<SegmentOption<ScopeMode>> = [
  { value: 'original', label: 'Original' },
  { value: 'remaining', label: 'Remaining' },
];

/**
 * The strip above the chart: the filter, the review controls, the view controls with the zoom control and the More
 * menu, the shown chain's status, and, at its end, the items' read time with Refresh and the link to Settings.
 */
export function ChartStrip({
  chainView,
  filterBar,
  refresh,
  review,
  showAllEdges,
  onShowAllEdgesChange,
  scopeMode,
  onScopeModeChange,
  settingsHref,
  zoom,
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
      <div className="tr-view-controls">
        <Switch isChecked={showAllEdges} onChange={onShowAllEdgesChange}>
          All edges
        </Switch>
        <span className="tr-scope">
          <span aria-hidden="true" className="tr-scope-label">
            Scope
          </span>
          <SegmentedControl label="Scope" onChange={onScopeModeChange} options={SCOPE_OPTIONS} value={scopeMode} />
        </span>
        <ZoomControl {...zoom} />
        <MoreMenu
          hasChain={chainView.chain.length > 0}
          isChainShown={chainView.isShown}
          onChainShownChange={chainView.setShown}
        />
      </div>
      {chainView.isShown ? (
        <div aria-label="Longest chain" className="tr-chain" role="toolbar">
          <span aria-live="polite" className="tr-review-position">
            Longest chain · {chainView.chain.length} items
          </span>
          <button className="tr-review-button" onClick={() => chainView.setShown(false)} type="button">
            End chain view
          </button>
        </div>
      ) : null}
      {refresh === undefined && settingsHref === undefined ? null : (
        <div className="tr-strip-end">
          {refresh === undefined ? null : <RefreshControl {...refresh} />}
          {settingsHref === undefined ? null : (
            <a className="tr-strip-link" href={settingsHref}>
              Settings
            </a>
          )}
        </div>
      )}
    </div>
  );
}
