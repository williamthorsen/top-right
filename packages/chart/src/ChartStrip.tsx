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
  titles: StripTitles;
  scopeMode: ScopeMode;
  onScopeModeChange: (scopeMode: ScopeMode) => void;
  zoom: ZoomState;
}

/** The titles lane's switches, and whether the chart area has room for the lane. */
export interface StripTitles {
  isShown: boolean;
  onShownChange: (isShown: boolean) => void;
  hasLines: boolean;
  onLinesChange: (hasLines: boolean) => void;
  hasRoom: boolean;
}

/** The scope modes that the strip offers, in display order. */
const SCOPE_OPTIONS: ReadonlyArray<SegmentOption<ScopeMode>> = [
  { value: 'original', label: 'Original' },
  { value: 'remaining', label: 'Remaining' },
];

/**
 * The strip above the chart: the filter, the review controls, the view controls with the titles switches, the zoom
 * control, and the More menu, the shown chain's status, and, at its end, the items' read time with Refresh.
 */
export function ChartStrip({
  chainView,
  filterBar,
  refresh,
  review,
  showAllEdges,
  onShowAllEdgesChange,
  titles,
  scopeMode,
  onScopeModeChange,
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
        <Switch isChecked={titles.isShown} onChange={titles.onShownChange}>
          Titles
        </Switch>
        <Switch isChecked={titles.hasLines} isDisabled={!titles.isShown} onChange={titles.onLinesChange}>
          Lines
        </Switch>
        {titles.isShown && !titles.hasRoom ? (
          <span className="tr-strip-note">No room for titles: widen the window or zoom out</span>
        ) : null}
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
      {refresh === undefined ? null : (
        <div className="tr-strip-end">
          <RefreshControl {...refresh} />
        </div>
      )}
    </div>
  );
}
