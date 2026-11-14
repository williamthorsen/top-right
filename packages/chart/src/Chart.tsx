import {
  buildRelationGraph,
  type Collection,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  formatItemKey,
  type ItemFilter,
  type ItemScores,
  listBlockedKeys,
  revealItem,
  type ScoreField,
  type ScoreLabelMapping,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, useMemo, useRef, useState } from 'react';

import { findCellCallouts } from './callout-layout.ts';
import { ChartCanvas } from './ChartCanvas.tsx';
import { ChartStrip } from './ChartStrip.tsx';
import { choosePaneMode, DetailPane } from './DetailPane.tsx';
import { Divider } from './Divider.tsx';
import { focusItem, mergeChainEdges } from './Edges.tsx';
import { Ghosts, layoutGhosts } from './Ghosts.tsx';
import type { Abbreviations } from './item-label.ts';
import { ItemTable } from './ItemTable.tsx';
import { findCellLevels, type GhostPlacement, layoutCells, placeItems, type ScopeMode } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { SettableStatus } from './PaneScores.tsx';
import type { ChartRefresh } from './RefreshControl.tsx';
import { resolveScores } from './resolve-scores.ts';
import type { Fade } from './ScoredCircle.tsx';
import { listTrails } from './Trail.tsx';
import { useCellHover } from './useCellHover.ts';
import { useChainView } from './useChainView.ts';
import { useItemDrag } from './useItemDrag.ts';
import { useItemFilter } from './useItemFilter.ts';
import { usePan } from './usePan.ts';
import { useReview } from './useReview.ts';
import { useSelection } from './useSelection.ts';
import { useShownReposReport } from './useShownReposReport.ts';
import { useVisibleSelection } from './useVisibleSelection.ts';
import { useZoom } from './useZoom.ts';

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
  onStatusChange?: (itemKey: string, status: SettableStatus) => void;
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
  onShownReposChange,
}: ChartProps): ReactElement {
  const selection = useSelection({ selectedKey: hostSelectedKey, onSelectedKeyChange });
  const [previewKey, setPreviewKey] = useState<string>();
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('original');
  const [highlightedKey, setHighlightedKey] = useState<string>();
  const [highlightOwner, setHighlightOwner] = useState<string>();

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
  if (previewKey !== undefined && !visibleKeys.has(previewKey)) setPreviewKey(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useZoom({
    scrollRef,
    contentRef: svgRef,
    keyRootRef: rootRef,
    magnification,
    onMagnificationChange,
  });
  const { cellSize } = zoom;
  const scale = zoom.magnification;
  const cells = useMemo(
    () => layoutCells(placeItems(visibleItems, scores, scopeMode), cellSize),
    [visibleItems, scores, scopeMode, cellSize],
  );

  const shownKey = previewKey ?? selectedKey;
  // A relation row unmounts without a pointer-leave or blur when the pane changes item, so the highlight ends with it.
  if (highlightOwner !== shownKey) {
    setHighlightOwner(shownKey);
    setHighlightedKey(undefined);
  }
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
    scrollRef,
  });
  const chainView = useChainView(visibleItems, review);
  if (isRevealing && review.kind !== undefined) review.end();
  const { drag, dragHandlersFor, selectItem, isHoldingPress } = useItemDrag({
    svgRef,
    cellSize,
    scores,
    scopeMode,
    selectedKey,
    onDrop: (key, cell) => {
      const levels = findCellLevels(cell.u, cell.v);
      if (levels) review.changeScores(key, levels);
    },
    onSelect: selection.push,
  });
  usePan({ scrollRef, isHoldingPress });
  const callouts = findCellCallouts(cells, useCellHover({ scrollRef, svgRef, cellSize }), cellSize);
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

  const focusKey = previewKey ?? selectedKey;
  const focus = focusItem(graph, focusKey, showAllEdges);
  const board = { itemsByKey, overrides, scopeMode, scores, shownRepos, visibleKeys };
  const shownEdges = chainView.isShown ? mergeChainEdges(focus.edges, chainView.chain) : focus.edges;
  const { ends, ghosts, ghostOwner } = layoutGhosts(cells, shownEdges, focusKey, board, cellSize);
  const ghostElements = (
    <Ghosts
      fadeOf={fadeOf}
      ghosts={ghosts}
      itemsByKey={itemsByKey}
      labelOf={labelOf}
      onReveal={selectShown}
      workTypeMapping={workTypeMapping}
    />
  );
  const focusRelated = findShownRelated(focus.related, focusKey, visibleKeys, ghosts);
  // A running review's fade governs, then the chain's, so that the queue or the chain stays legible under hover; then a
  // hovered cell's, so that its callouts read over the rest.
  function fadeOf(key: string): Fade | undefined {
    if (review.kind !== undefined) return review.isFaded(key) ? 'strong' : undefined;
    if (chainView.isShown) return chainView.isFaded(key) ? 'strong' : undefined;
    if (callouts) return callouts.cell.ids.includes(key) ? undefined : 'soft';
    return focusRelated === undefined || focusRelated.has(key) ? undefined : 'soft';
  }

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
            zoom={zoom}
          />
          <div className="tr-split" ref={splitRef}>
            <div className="tr-chart-pane" style={{ flexBasis: `${split}%` }}>
              <ChartCanvas
                callouts={callouts}
                cellSize={cellSize}
                drag={drag}
                edges={shownEdges}
                ends={ends}
                scale={scale}
                scoredCells={{
                  blockedKeys,
                  cells,
                  dragHandlersFor,
                  draggingKey: drag?.key,
                  fadeOf,
                  ghostOwner,
                  ghosts: ghostElements,
                  highlightedKey,
                  itemsByKey,
                  labelOf,
                  onPreview: setPreviewKey,
                  onSelect: selectItem,
                  overrides,
                  scopeMode,
                  scores,
                  selectedKey,
                  workTypeMapping,
                }}
                scrollRef={scrollRef}
                svgRef={svgRef}
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

// region | Helpers
/**
 * Returns the focus's related items while the board shows one of them other than the focused item, as a circle, a
 * gutter row, or a ghost, since only then does the focus fade emphasise anything.
 */
function findShownRelated(
  related: ReadonlySet<string> | undefined,
  focusKey: string | undefined,
  visibleKeys: ReadonlySet<string>,
  ghosts: readonly GhostPlacement[],
): ReadonlySet<string> | undefined {
  const ghostKeys = new Set(ghosts.map((ghost) => ghost.id));
  const isShown = related?.values().some((key) => key !== focusKey && (visibleKeys.has(key) || ghostKeys.has(key)));
  return isShown ? related : undefined;
}
// endregion | Helpers
