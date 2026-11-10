import {
  buildRelationGraph,
  classifyWorkType,
  DEFAULT_WORK_TYPE_MAPPING,
  deriveStatus,
  findNextPick,
  formatItemKey,
  isAgentScored,
  type ItemFilter,
  type ItemScores,
  listBlockedKeys,
  revealItem,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { Fragment, type ReactElement, useMemo, useRef, useState } from 'react';

import { ChartStrip } from './ChartStrip.tsx';
import { choosePaneMode, DetailPane } from './DetailPane.tsx';
import { Divider } from './Divider.tsx';
import { DragProxy, DropTarget } from './DragMarks.tsx';
import { Edges, focusItem, mergeChainEdges } from './Edges.tsx';
import { Ghosts, layoutGhosts } from './Ghosts.tsx';
import { Grid, HEIGHT, MARGIN_LEFT, MARGIN_TOP, WIDTH } from './Grid.tsx';
import { GutterCell } from './GutterCell.tsx';
import { type Abbreviations, nameCircle } from './item-label.ts';
import { ItemTable } from './ItemTable.tsx';
import { layoutCells, placeItems, type ScopeMode } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { SettableStatus } from './PaneScores.tsx';
import { ScoredCircle } from './ScoredCircle.tsx';
import { listTrails, Trail } from './Trail.tsx';
import { useChainView } from './useChainView.ts';
import { useItemDrag } from './useItemDrag.ts';
import { useItemFilter } from './useItemFilter.ts';
import { useReview } from './useReview.ts';
import { useSelection } from './useSelection.ts';
import { useVisibleSelection } from './useVisibleSelection.ts';
import { useZoom } from './useZoom.ts';

import './chart.css';

export interface ChartProps {
  items: readonly WorkItem[];
  /** Repository abbreviations keyed by `owner/name`; a repository without one takes its first letter. */
  abbreviations: Abbreviations;
  workTypeMapping?: WorkTypeMapping;
  /** Where the host's Settings page is; without it, the chart does not link to Settings. */
  settingsHref?: string | undefined;
  /** The user's scores by item key; an item without an entry is unscored. */
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
}

/** The chart pane's initial share of the height that it splits with the table, as a percentage. */
const INITIAL_SPLIT = 60;
const NO_SCORES: Readonly<Record<string, ItemScores>> = {};
const NO_OVERRIDES: Readonly<Record<string, StatusOverride>> = {};
/** Where the matrix's origin sits in the SVG, past the axis margins. */
const MATRIX_ORIGIN = { x: MARGIN_LEFT, y: MARGIN_TOP };
const MATRIX_TRANSFORM = `translate(${MATRIX_ORIGIN.x} ${MATRIX_ORIGIN.y})`;

/**
 * The Top Right chart: items by urgency and impact, with the legend, the table, and the detail pane. It fills its
 * container's height, which the container must bound for the table to scroll within its pane.
 */
export function Chart({
  items,
  abbreviations,
  workTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
  settingsHref,
  scores = NO_SCORES,
  overrides = NO_OVERRIDES,
  onScoresChange,
  onStatusChange,
  onKeep,
  selectedKey: hostSelectedKey,
  onSelectedKeyChange,
}: ChartProps): ReactElement {
  const selection = useSelection({ selectedKey: hostSelectedKey, onSelectedKeyChange });
  const [previewKey, setPreviewKey] = useState<string>();
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('original');
  const [highlightedKey, setHighlightedKey] = useState<string>();
  const [highlightOwner, setHighlightOwner] = useState<string>();

  const itemsByKey = useMemo(() => new Map(items.map((item) => [formatItemKey(item), item])), [items]);
  const blockedKeys = useMemo(() => listBlockedKeys(items), [items]);
  const graph = useMemo(() => buildRelationGraph(items), [items]);
  const { filter, setFilter, visibleItems, visibleKeys, statusCounts, labelOf } = useItemFilter(
    items,
    overrides,
    abbreviations,
  );
  const { selectedKey, isRevealing } = useVisibleSelection(selection, visibleKeys, (key) => {
    const item = itemsByKey.get(key);
    if (item) setFilter(revealItem(filter, item, overrides[key]));
    return item !== undefined;
  });
  if (previewKey !== undefined && !visibleKeys.has(previewKey)) setPreviewKey(undefined);
  const cells = useMemo(
    () => layoutCells(placeItems(visibleItems, scores, scopeMode)),
    [visibleItems, scores, scopeMode],
  );

  const pickKey = useMemo(() => findNextPick(visibleItems, scores, overrides), [visibleItems, scores, overrides]);
  const shownKey = previewKey ?? selectedKey ?? pickKey;
  // A relation row unmounts without a pointer-leave or blur when the pane changes item, so the highlight ends with it.
  if (highlightOwner !== shownKey) {
    setHighlightOwner(shownKey);
    setHighlightedKey(undefined);
  }
  const shownItem = shownKey === undefined ? undefined : itemsByKey.get(shownKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoom = useZoom({ scrollRef, keyRootRef: rootRef });
  const scale = zoom.zoom.scale;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const { drag, dragHandlersFor, selectItem } = useItemDrag({
    svgRef,
    scores,
    scopeMode,
    selectedKey,
    onDrop: (key, cell) => review.changeScores(key, { urgency: cell.u, impact: cell.i }),
    onSelect: selection.push,
  });
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
  const { ends, ghosts, ghostOwner } = layoutGhosts(cells, shownEdges, focusKey, board);
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
            filterBar={{ abbreviations, counts: statusCounts, filter, onChange: changeFilter }}
            onScopeModeChange={setScopeMode}
            onShowAllEdgesChange={setShowAllEdges}
            review={chainView.review}
            scopeMode={scopeMode}
            settingsHref={settingsHref}
            showAllEdges={showAllEdges}
          />
          <div className="tr-split" ref={splitRef}>
            <div className="tr-chart-pane" style={{ flexBasis: `${split}%` }}>
              <div className="tr-chart-scroll" ref={scrollRef}>
                <svg
                  aria-label="Items by urgency and impact"
                  className="tr-chart"
                  height={HEIGHT * scale}
                  ref={svgRef}
                  role="group"
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  width={WIDTH * scale}
                >
                  <Grid />
                  <g transform={MATRIX_TRANSFORM}>
                    <DropTarget drag={drag} />
                    {trails.map((trail) => (
                      <Trail key={trail.id} origin={trail.origin} r={trail.r} x={trail.x} y={trail.y} />
                    ))}
                    <Edges edges={shownEdges} ends={ends} />
                    {cells.map((cell) =>
                      cell.isGutter ? null : (
                        <g key={`${cell.u},${cell.i}`}>
                          {cell.circles.map((circle) => {
                            const item = itemsByKey.get(circle.id);
                            if (!item) return null;
                            const circleElement = (
                              <ScoredCircle
                                cellX={cell.x}
                                cellY={cell.y}
                                circle={circle}
                                isAgentScored={isAgentScored(scores[circle.id])}
                                isBlocked={blockedKeys.has(circle.id)}
                                isHighlighted={circle.id === highlightedKey}
                                isPick={circle.id === pickKey}
                                isFaded={isFaded(circle.id)}
                                isSelected={circle.id === selectedKey}
                                dragHandlers={dragHandlersFor(circle.id, circle.r)}
                                isDragging={circle.id === drag?.key}
                                key={circle.id}
                                name={nameCircle(labelOf(item), item.title, {
                                  isBlocked: blockedKeys.has(circle.id),
                                  isPick: circle.id === pickKey,
                                })}
                                onPreview={setPreviewKey}
                                onSelect={selectItem}
                                progress={scores[circle.id]?.progress?.value ?? 0}
                                scopeMode={scopeMode}
                                status={deriveStatus(item, overrides[circle.id])}
                                workType={classifyWorkType(item.labels, workTypeMapping)}
                              />
                            );
                            return (
                              <Fragment key={circle.id}>
                                {circleElement}
                                {circle.id === ghostOwner ? ghostElements : null}
                              </Fragment>
                            );
                          })}
                        </g>
                      ),
                    )}
                    {ghostOwner === undefined ? ghostElements : null}
                  </g>
                  {cells.map((cell) =>
                    cell.isGutter ? (
                      <GutterCell
                        blockedKeys={blockedKeys}
                        cell={cell}
                        dragHandlersFor={dragHandlersFor}
                        draggingKey={drag?.key}
                        highlightedKey={highlightedKey}
                        isFaded={isFaded}
                        itemsByKey={itemsByKey}
                        key={`${cell.u},${cell.i}`}
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
                  <g transform={MATRIX_TRANSFORM}>
                    <DragProxy drag={drag} />
                  </g>
                </svg>
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
