import {
  buildRelationGraph,
  type Collection,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  formatItemKey,
  type ItemFilter,
  type ItemScores,
  listBlockedKeys,
  type OpenStatus,
  revealItem,
  type ScoreField,
  type ScoreLabelMapping,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, useMemo, useRef, useState } from 'react';

import { ChartCanvas } from './ChartCanvas.tsx';
import { ChartStrip } from './ChartStrip.tsx';
import { choosePaneMode, DetailPane } from './DetailPane.tsx';
import { Divider } from './Divider.tsx';
import { buildFocusView } from './focus-view.ts';
import { Ghosts } from './Ghosts.tsx';
import type { Abbreviations } from './item-label.ts';
import { ItemTable } from './ItemTable.tsx';
import type { ScopeMode } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { ChartRefresh } from './RefreshControl.tsx';
import { resolveScores } from './resolve-scores.ts';
import { listTrails } from './Trail.tsx';
import { useChainView } from './useChainView.ts';
import { useChartFocus } from './useChartFocus.ts';
import { useHostSetting } from './useHostSetting.ts';
import { useItemFilter } from './useItemFilter.ts';
import { useMatrix } from './useMatrix.ts';
import { useReview } from './useReview.ts';
import { useSelection } from './useSelection.ts';
import { useShownReposReport } from './useShownReposReport.ts';
import { useVisibleSelection } from './useVisibleSelection.ts';

import './chart.css';

export interface ChartProps {
  items: readonly WorkItem[];
  /** Repository abbreviations keyed by `owner/name`; a repository without one takes its uppercase first letter. */
  abbreviations: Abbreviations;
  /** The user's collections of repositories, which the filter offers beside the repositories. */
  collections?: readonly Collection[];
  /** The collection that the filter starts at on mount; without it, or for an unknown id, every repository. */
  defaultCollectionId?: string | undefined;
  workTypeMapping?: WorkTypeMapping;
  /** The labels that supply urgency, value, and effort where an item has no stored score for them. */
  scoreLabelMapping?: ScoreLabelMapping;
  /** Where the host's Settings page is, for the legend's mapping popover; without it, the popover does not link. */
  settingsHref?: string | undefined;
  /** The host's read of the items; without it, the chart shows neither the read time nor Refresh. */
  refresh?: ChartRefresh | undefined;
  /** The user's stored scores by item key; an item without an entry is unscored unless its labels supply a score. */
  scores?: Readonly<Record<string, ItemScores>>;
  /** The user's status overrides by item key. */
  overrides?: Readonly<Record<string, StatusOverride>>;
  /** Reports a change of one or more of an item's scores; the host writes them and passes the result back. */
  onScoresChange?: (itemKey: string, scores: Scores) => void;
  /** Reports scores that the author clears from an item; without it, the pane offers no clear buttons. */
  onScoresClear?: (itemKey: string, fields: readonly ScoreField[]) => void;
  /** Reports a status that the user chose for an item. */
  onStatusChange?: (itemKey: string, status: OpenStatus) => void;
  /** Reports that the author keeps an item's agent scores; without it, the chart offers neither Keep nor Enter-to-keep. */
  onKeep?: (itemKey: string) => void;
  /**
   * The selected item's key, read only while `onSelectedKeyChange` is passed; a new key whose item the filter hides
   * widens the filter.
   */
  selectedKey?: string | undefined;
  /**
   * Reports a change of selection, which makes the selection the host's to hold. `push` is true for a selection that
   * the author makes (a click or a key on a circle, a gutter id, or a table row; Close; Escape), so that the host can
   * record it as a history entry, and false for one that the chart makes itself, such as a review step.
   */
  onSelectedKeyChange?: (key: string | undefined, options: { push: boolean }) => void;
  /**
   * The scale from chart units to pixels, which sets the size of the chart's text and circles, read only while
   * `onMagnificationChange` is passed; 100 % when undefined. The chart area sets the cells' size.
   */
  magnification?: number | undefined;
  /** Reports a magnification that the author chose, which makes the magnification the host's to hold. */
  onMagnificationChange?: (magnification: number) => void;
  /**
   * Whether the titles lane shows every scored item's title beside the matrix, read only while `onShowTitlesChange` is
   * passed; off when undefined.
   */
  showTitles?: boolean | undefined;
  /** Reports a change of the Titles switch, which makes its state the host's to hold. */
  onShowTitlesChange?: (showTitles: boolean) => void;
  /**
   * Whether every row of the titles lane has a leader to its circle, read only while `onShowLinesChange` is passed; on
   * when undefined.
   */
  showLines?: boolean | undefined;
  /** Reports a change of the Lines switch, which makes its state the host's to hold. */
  onShowLinesChange?: (showLines: boolean) => void;
  /**
   * Reports the repositories that the filter shows, on mount and whenever they change, so that the host can read the
   * ones that it has not read; undefined stands for every repository.
   */
  onShownReposChange?: ((repos: ReadonlySet<string> | undefined) => void) | undefined;
}

/** The chart pane's initial share of the height that it splits with the table, as a percentage. */
const INITIAL_SPLIT = 60;
const NO_SCORES: Readonly<Record<string, ItemScores>> = {};
const NO_OVERRIDES: Readonly<Record<string, StatusOverride>> = {};

/**
 * The Top Right chart: items by urgency and value, with the legend, the table, and the detail pane. It fills its
 * container's height, which the container must bound for the table to scroll within its pane.
 */
export function Chart({
  items,
  abbreviations,
  collections,
  defaultCollectionId,
  workTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
  scoreLabelMapping = DEFAULT_SCORE_LABEL_MAPPING,
  settingsHref,
  refresh,
  scores: storedScores = NO_SCORES,
  overrides = NO_OVERRIDES,
  onScoresChange,
  onScoresClear,
  onStatusChange,
  onKeep,
  selectedKey: hostSelectedKey,
  onSelectedKeyChange,
  magnification,
  onMagnificationChange,
  showTitles: hostShowTitles,
  onShowTitlesChange,
  showLines: hostShowLines,
  onShowLinesChange,
  onShownReposChange,
}: ChartProps): ReactElement {
  const selection = useSelection({ selectedKey: hostSelectedKey, onSelectedKeyChange });
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [showTitles, setShowTitles] = useHostSetting(hostShowTitles, onShowTitlesChange, false);
  const [showLines, setShowLines] = useHostSetting(hostShowLines, onShowLinesChange, true);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('original');

  const itemsByKey = useMemo(() => new Map(items.map((item) => [formatItemKey(item), item])), [items]);
  const scores = useMemo(
    () => resolveScores(items, storedScores, scoreLabelMapping),
    [items, storedScores, scoreLabelMapping],
  );
  const blockedKeys = useMemo(() => listBlockedKeys(items), [items]);
  const graph = useMemo(() => buildRelationGraph(items), [items]);
  const { filter, setFilter, shownRepos, visibleItems, visibleKeys, statusCounts, labelOf } = useItemFilter(
    items,
    overrides,
    abbreviations,
    collections,
    defaultCollectionId,
  );
  useShownReposReport(shownRepos, onShownReposChange);
  const { selectedKey, isRevealing } = useVisibleSelection(selection, visibleKeys, (key) => {
    const item = itemsByKey.get(key);
    if (item) setFilter(revealItem(filter, item, overrides[key], shownRepos));
    return item !== undefined;
  });
  const { previewKey, setPreviewKey, highlightedKey, setHighlightedKey, shownKey } = useChartFocus(
    selectedKey,
    visibleKeys,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const shownItem = shownKey === undefined ? undefined : itemsByKey.get(shownKey);
  const review = useReview({
    items: visibleItems,
    scores,
    selectedKey,
    setSelectedKey: selection.replace,
    pushSelectedKey: selection.push,
    setPreviewKey,
    onKeep,
    onScoresChange,
    onScoresClear,
  });
  const chainView = useChainView(visibleItems, review);
  if (isRevealing && review.kind !== undefined) review.end();
  const matrix = useMatrix({
    keyRootRef: rootRef,
    items: visibleItems,
    scores,
    scopeMode,
    graph,
    magnification,
    onMagnificationChange,
    showTitles,
    showLines,
    selectedKey,
    hoveredKey: previewKey ?? highlightedKey,
    onHighlight: setHighlightedKey,
    onSelect: selection.push,
    onScoresChange: review.changeScores,
  });
  const { zoom, cells, pulse, drag, titleLane } = matrix;
  const { cellSize } = zoom;
  const splitRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(INITIAL_SPLIT);

  /** Applies a filter, ending a running review, whose queue the filter would change under it. */
  function changeFilter(next: ItemFilter): void {
    setFilter({ ...next, revealedKeys: new Set() });
    if (review.kind !== undefined) review.end();
  }

  /** Selects one of the items, revealing it alone when the filter hides it, which ends a running review. */
  function selectShown(key: string): void {
    if (!itemsByKey.has(key)) return;
    if (!visibleKeys.has(key)) {
      setFilter({ ...filter, revealedKeys: new Set([...filter.revealedKeys, key]) });
      if (review.kind !== undefined) review.end();
    }
    selection.push(key);
  }

  const board = { itemsByKey, overrides, scopeMode, scores, shownRepos, visibleKeys };
  const focusState = {
    graph,
    focusKey: shownKey,
    highlightedKey,
    showAllEdges,
    chainView,
    review,
    callouts: matrix.hoveredCallouts,
  };
  const { edges, ends, ghosts, ghostOwner, fadeOf } = buildFocusView(focusState, cells, board, cellSize);
  const ghostElements = (
    <Ghosts
      fadeOf={fadeOf}
      ghosts={ghosts}
      itemsByKey={itemsByKey}
      labelOf={labelOf}
      onReveal={pulse.fromMatrix(selectShown)}
      workTypeMapping={workTypeMapping}
    />
  );

  const trails = listTrails(
    cells,
    scores,
    (key) => review.kind === 'agent' || key === previewKey || key === selectedKey,
  );

  return (
    <div className="tr-root" ref={rootRef}>
      <div className="tr-work">
        <div className="tr-chart-area">
          <ChartStrip
            chainView={chainView}
            filterBar={{ abbreviations, collections, counts: statusCounts, filter, onChange: changeFilter }}
            onScopeModeChange={setScopeMode}
            onShowAllEdgesChange={setShowAllEdges}
            refresh={refresh}
            review={chainView.review}
            scopeMode={scopeMode}
            showAllEdges={showAllEdges}
            titles={{
              isShown: showTitles,
              onShownChange: setShowTitles,
              hasLines: showLines,
              onLinesChange: setShowLines,
              hasRoom: titleLane !== undefined,
            }}
            zoom={zoom}
          />
          <div className="tr-split" ref={splitRef}>
            <div className="tr-chart-pane" style={{ flexBasis: `${split}%` }}>
              <ChartCanvas
                callouts={matrix.callouts}
                cellSize={cellSize}
                titleLane={titleLane}
                pulse={pulse}
                drag={drag}
                edges={edges}
                ends={ends}
                scale={zoom.magnification}
                scoredCells={{
                  blockedKeys,
                  cells,
                  dragHandlersFor: matrix.dragHandlersFor,
                  draggingKey: drag?.key,
                  fadeOf,
                  ghostOwner,
                  ghosts: ghostElements,
                  highlightedKey,
                  itemsByKey,
                  labelOf,
                  onPreview: setPreviewKey,
                  onSelect: matrix.selectItem,
                  overrides,
                  scopeMode,
                  scores,
                  selectedKey,
                  workTypeMapping,
                }}
                scrollRef={matrix.scrollRef}
                svgRef={matrix.svgRef}
                trails={trails}
              />
              <Legend settingsHref={settingsHref} workTypeMapping={workTypeMapping} />
            </div>
            <Divider containerRef={splitRef} label="Chart and table" onChange={setSplit} value={split} />
            <div className="tr-table-pane">
              <ItemTable
                items={visibleItems}
                labelOf={labelOf}
                onHighlight={setHighlightedKey}
                onSelect={selection.push}
                overrides={overrides}
                scores={scores}
                selectedKey={selectedKey}
                workTypeMapping={workTypeMapping}
              />
            </div>
          </div>
        </div>
        <DetailPane
          abbreviations={abbreviations}
          blockedKeys={blockedKeys}
          isReviewing={review.kind !== undefined}
          item={shownItem}
          mode={choosePaneMode(previewKey, selectedKey)}
          onClose={() => {
            selection.push(undefined);
            setPreviewKey(undefined);
          }}
          isGiven={(itemKey) => itemsByKey.has(itemKey)}
          onKeep={onKeep ? review.keep : undefined}
          onRelationHighlight={setHighlightedKey}
          onRelationSelect={selectShown}
          onScoresChange={review.changeScores}
          onScoresClear={onScoresClear ? review.clearScores : undefined}
          onStatusChange={(itemKey, status) => {
            selection.replace(itemKey);
            onStatusChange?.(itemKey, status);
          }}
          override={shownKey === undefined ? undefined : overrides[shownKey]}
          scores={shownKey === undefined ? undefined : scores[shownKey]}
          workTypeMapping={workTypeMapping}
        />
      </div>
    </div>
  );
}
