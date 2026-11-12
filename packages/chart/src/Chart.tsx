import {
  buildRelationGraph,
  type Collection,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  findNextPick,
  formatItemKey,
  type ItemFilter,
  type ItemScores,
  listBlockedKeys,
  type ResolvedItemScores,
  resolveItemScores,
  revealItem,
  type ScoreLabelMapping,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, useMemo, useRef, useState } from 'react';

import { ChartStrip } from './ChartStrip.tsx';
import { choosePaneMode, DetailPane } from './DetailPane.tsx';
import { Divider } from './Divider.tsx';
import { DragProxy, DropTarget } from './DragMarks.tsx';
import { Edges, focusItem, mergeChainEdges } from './Edges.tsx';
import { Ghosts, layoutGhosts } from './Ghosts.tsx';
import { Grid, MARGIN_LEFT, MARGIN_TOP, measureFrame } from './Grid.tsx';
import { GutterCell } from './GutterCell.tsx';
import type { Abbreviations } from './item-label.ts';
import { ItemTable } from './ItemTable.tsx';
import { findCellLevels, layoutCells, placeItems, type ScopeMode } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { SettableStatus } from './PaneScores.tsx';
import type { ChartRefresh } from './RefreshControl.tsx';
import { ScoredCells } from './ScoredCells.tsx';
import { listTrails, Trail } from './Trail.tsx';
import { useChainView } from './useChainView.ts';
import { useItemDrag } from './useItemDrag.ts';
import { useItemFilter } from './useItemFilter.ts';
import { usePan } from './usePan.ts';
import { useReview } from './useReview.ts';
import { useSelection } from './useSelection.ts';
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
}

/** The chart pane's initial share of the height that it splits with the table, as a percentage. */
const INITIAL_SPLIT = 60;
const NO_COLLECTIONS: readonly Collection[] = [];
const NO_SCORES: Readonly<Record<string, ItemScores>> = {};
const NO_OVERRIDES: Readonly<Record<string, StatusOverride>> = {};
/** Where the matrix's origin sits in the SVG, past the axis margins. */
const MATRIX_ORIGIN = { x: MARGIN_LEFT, y: MARGIN_TOP };
const MATRIX_TRANSFORM = `translate(${MATRIX_ORIGIN.x} ${MATRIX_ORIGIN.y})`;

/**
 * The Top Right chart: items by urgency and value, with the legend, the table, and the detail pane. It fills its
 * container's height, which the container must bound for the table to scroll within its pane.
 */
export function Chart({
  items,
  abbreviations,
  collections = NO_COLLECTIONS,
  defaultCollectionId,
  workTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
  scoreLabelMapping = DEFAULT_SCORE_LABEL_MAPPING,
  settingsHref,
  refresh,
  scores: storedScores = NO_SCORES,
  overrides = NO_OVERRIDES,
  onScoresChange,
  onStatusChange,
  onKeep,
  selectedKey: hostSelectedKey,
  onSelectedKeyChange,
  magnification,
  onMagnificationChange,
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
  const frame = measureFrame(cellSize);
  const cells = useMemo(
    () => layoutCells(placeItems(visibleItems, scores, scopeMode), cellSize),
    [visibleItems, scores, scopeMode, cellSize],
  );

  const pickKey = useMemo(() => findNextPick(visibleItems, scores, overrides), [visibleItems, scores, overrides]);
  const shownKey = previewKey ?? selectedKey ?? pickKey;
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
  const splitRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(INITIAL_SPLIT);

  /** Applies a filter, ending a running review, whose queue the filter would change under it. */
  function changeFilter(next: ItemFilter): void {
    setFilter({ ...next, revealedKeys: new Set() });
    if (review.kind !== undefined) review.end();
  }

  /** Reveals one hidden item and selects it, ending a running review, whose queue the reveal would change. */
  function revealGhost(key: string): void {
    setFilter({ ...filter, revealedKeys: new Set([...filter.revealedKeys, key]) });
    if (review.kind !== undefined) review.end();
    selection.push(key);
  }

  const focusKey = previewKey ?? selectedKey;
  const focus = focusItem(graph, focusKey, showAllEdges);
  const board = { itemsByKey, overrides, scopeMode, scores, visibleKeys };
  const shownEdges = chainView.isShown ? mergeChainEdges(focus.edges, chainView.chain) : focus.edges;
  const { ends, ghosts, ghostOwner } = layoutGhosts(cells, shownEdges, focusKey, board, cellSize);
  const ghostElements = (
    <Ghosts ghosts={ghosts} isFaded={isFaded} itemsByKey={itemsByKey} labelOf={labelOf} onReveal={revealGhost} />
  );
  // A running review's fade governs, then the chain's, so that the queue or the chain stays legible under hover.
  function isFaded(key: string): boolean {
    if (review.kind !== undefined) return review.isFaded(key);
    if (chainView.isShown) return chainView.isFaded(key);
    return focus.related !== undefined && !focus.related.has(key);
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
              <div className="tr-chart-scroll" ref={scrollRef}>
                <div className="tr-canvas" style={{ width: frame.width * scale, height: frame.height * scale }}>
                  <svg
                    aria-label="Items by urgency and value"
                    className="tr-chart"
                    height={frame.height * scale}
                    ref={svgRef}
                    role="group"
                    viewBox={`0 0 ${frame.width} ${frame.height}`}
                    width={frame.width * scale}
                  >
                    <Grid cellSize={cellSize} />
                    <g transform={MATRIX_TRANSFORM}>
                      <DropTarget cellSize={cellSize} drag={drag} />
                      {trails.map((trail) => (
                        <Trail
                          cellSize={cellSize}
                          key={trail.id}
                          origin={trail.origin}
                          r={trail.r}
                          x={trail.x}
                          y={trail.y}
                        />
                      ))}
                      <Edges edges={shownEdges} ends={ends} />
                      <ScoredCells
                        blockedKeys={blockedKeys}
                        cells={cells}
                        dragHandlersFor={dragHandlersFor}
                        draggingKey={drag?.key}
                        ghostOwner={ghostOwner}
                        ghosts={ghostElements}
                        highlightedKey={highlightedKey}
                        isFaded={isFaded}
                        itemsByKey={itemsByKey}
                        labelOf={labelOf}
                        onPreview={setPreviewKey}
                        onSelect={selectItem}
                        overrides={overrides}
                        pickKey={pickKey}
                        scopeMode={scopeMode}
                        scores={scores}
                        selectedKey={selectedKey}
                        workTypeMapping={workTypeMapping}
                      />
                      {ghostOwner === undefined ? ghostElements : null}
                    </g>
                  </svg>
                  {/* HTML rather than a foreignObject, which WebKit neither draws nor hit-tests at the SVG's scale. */}
                  <div
                    className="tr-gutters"
                    style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}
                  >
                    {cells.map((cell) =>
                      cell.isGutter ? (
                        <GutterCell
                          blockedKeys={blockedKeys}
                          cell={cell}
                          cellSize={cellSize}
                          dragHandlersFor={dragHandlersFor}
                          draggingKey={drag?.key}
                          highlightedKey={highlightedKey}
                          isFaded={isFaded}
                          itemsByKey={itemsByKey}
                          key={`${cell.u},${cell.v}`}
                          labelOf={labelOf}
                          onPreview={setPreviewKey}
                          onSelect={selectItem}
                          origin={MATRIX_ORIGIN}
                          scores={scores}
                          selectedKey={selectedKey}
                          workTypeMapping={workTypeMapping}
                        />
                      ) : null,
                    )}
                  </div>
                  <svg aria-hidden="true" className="tr-chart-overlay" viewBox={`0 0 ${frame.width} ${frame.height}`}>
                    <g transform={MATRIX_TRANSFORM}>
                      <DragProxy drag={drag} />
                    </g>
                  </svg>
                </div>
              </div>
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
          onKeep={onKeep ? review.keep : undefined}
          onRelationHighlight={setHighlightedKey}
          onScoresChange={review.changeScores}
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
/** Returns each item's stored scores with the scores that its labels supply, by item key. */
function resolveScores(
  items: readonly WorkItem[],
  scores: Readonly<Record<string, ItemScores>>,
  mapping: ScoreLabelMapping,
): Record<string, ResolvedItemScores> {
  const resolved: Record<string, ResolvedItemScores> = {};
  for (const item of items) {
    const key = formatItemKey(item);
    resolved[key] = resolveItemScores(scores[key], item.labels, mapping);
  }
  return resolved;
}
// endregion | Helpers
