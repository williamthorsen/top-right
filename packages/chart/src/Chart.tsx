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
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';

import { choosePaneMode, DetailPane } from './DetailPane.tsx';
import { Edges, focusItem, listEdgeEnds } from './Edges.tsx';
import { FilterBar } from './FilterBar.tsx';
import { Grid, HEIGHT, MARGIN_LEFT, MARGIN_TOP, WIDTH } from './Grid.tsx';
import { GutterCell } from './GutterCell.tsx';
import type { Abbreviations } from './item-label.ts';
import { ItemTable } from './ItemTable.tsx';
import { layoutCells, sizeCircle } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { SettableStatus } from './PaneScores.tsx';
import { ReviewStrip } from './ReviewStrip.tsx';
import { ScoredCircle } from './ScoredCircle.tsx';
import { listTrails, Trail } from './Trail.tsx';
import { useItemFilter } from './useItemFilter.ts';
import { useReview } from './useReview.ts';
import { useSelection } from './useSelection.ts';
import { useVisibleSelection } from './useVisibleSelection.ts';

import './chart.css';

export interface ChartProps {
  items: readonly WorkItem[];
  /** Repository abbreviations keyed by `owner/name`; a repository without one takes its first letter. */
  abbreviations: Abbreviations;
  workTypeMapping?: WorkTypeMapping;
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
  /** The selected item's key, read only while `onSelectedKeyChange` is passed; a key that the filter hides widens the filter. */
  selectedKey?: string | undefined;
  /**
   * Reports a change of selection, which makes the selection the host's to hold. `push` is true for a selection that the
   * author makes (a click or a key on a circle, a gutter id, or a table row; Close; Escape), so that the host can record
   * it as a history entry, and false for one that the chart makes itself, such as a review step.
   */
  onSelectedKeyChange?: (key: string | undefined, options: { push: boolean }) => void;
}

const NO_SCORES: Readonly<Record<string, ItemScores>> = {};
const NO_OVERRIDES: Readonly<Record<string, StatusOverride>> = {};

/** The Top Right chart: items by urgency and impact, with the detail pane and the legend. */
export function Chart({
  items,
  abbreviations,
  workTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
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
    () =>
      layoutCells(
        visibleItems.map((item) => {
          const id = formatItemKey(item);
          const itemScores = scores[id];
          return {
            id,
            u: itemScores?.urgency?.value ?? 0,
            i: itemScores?.impact?.value ?? 0,
            ...sizeCircle(itemScores?.effort?.value),
          };
        }),
      ),
    [visibleItems, scores],
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
  });
  if (isRevealing && review.kind !== undefined) review.end();
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Applies a filter, ending a running review, whose queue the filter would change under it. */
  function changeFilter(next: ItemFilter): void {
    setFilter(next);
    if (review.kind !== undefined) review.end();
  }

  // Bring each item that a review moves to into view, since the chart scrolls on a narrow screen.
  useEffect(() => {
    if (review.kind === undefined || selectedKey === undefined) return;
    const element = scrollRef.current?.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [review.kind, selectedKey]);

  const focus = focusItem(graph, previewKey ?? selectedKey, showAllEdges);
  const ends = listEdgeEnds(cells);
  // A running review's fade governs, so that the queue stays legible as the review steps.
  function isFaded(key: string): boolean {
    return review.kind === undefined ? focus.related !== undefined && !focus.related.has(key) : review.isFaded(key);
  }

  const trails = listTrails(
    cells,
    scores,
    (key) => review.kind === 'agent' || key === previewKey || key === selectedKey,
  );

  return (
    <div className="tr-root">
      <div className="tr-work">
        <div className="tr-chart-area">
          <div className="tr-strip">
            <FilterBar abbreviations={abbreviations} counts={statusCounts} filter={filter} onChange={changeFilter} />
            <ReviewStrip
              counts={{ agent: review.queues.agent.length, unscored: review.queues.unscored.length }}
              onEnd={review.end}
              onSkip={review.skip}
              onStart={review.start}
              running={review.kind === undefined ? undefined : { kind: review.kind, position: review.position }}
            />
            <button
              aria-pressed={showAllEdges}
              className="tr-toggle"
              onClick={() => setShowAllEdges((current) => !current)}
              type="button"
            >
              All edges
            </button>
          </div>
          <div className="tr-chart-scroll" ref={scrollRef}>
            <svg
              aria-label="Items by urgency and impact"
              className="tr-chart"
              height={HEIGHT}
              role="group"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              width={WIDTH}
            >
              <Grid />
              <g transform={`translate(${MARGIN_LEFT} ${MARGIN_TOP})`}>
                {trails.map((trail) => (
                  <Trail key={trail.id} origin={trail.origin} r={trail.r} x={trail.x} y={trail.y} />
                ))}
                <Edges edges={focus.edges} ends={ends} />
                {cells.map((cell) =>
                  cell.isGutter ? null : (
                    <g key={`${cell.u},${cell.i}`}>
                      {cell.circles.map((circle) => {
                        const item = itemsByKey.get(circle.id);
                        if (!item) return null;
                        return (
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
                            key={circle.id}
                            name={nameCircle(labelOf(item), item.title, {
                              isBlocked: blockedKeys.has(circle.id),
                              isPick: circle.id === pickKey,
                            })}
                            onPreview={setPreviewKey}
                            onSelect={selection.push}
                            progress={scores[circle.id]?.progress?.value ?? 0}
                            status={deriveStatus(item, overrides[circle.id])}
                            workType={classifyWorkType(item.labels, workTypeMapping)}
                          />
                        );
                      })}
                    </g>
                  ),
                )}
                {cells.map((cell) =>
                  cell.isGutter ? (
                    <GutterCell
                      blockedKeys={blockedKeys}
                      cell={cell}
                      highlightedKey={highlightedKey}
                      isFaded={isFaded}
                      itemsByKey={itemsByKey}
                      key={`${cell.u},${cell.i}`}
                      labelOf={labelOf}
                      onPreview={setPreviewKey}
                      onSelect={selection.push}
                      scores={scores}
                      selectedKey={selectedKey}
                      workTypeMapping={workTypeMapping}
                    />
                  ) : null,
                )}
              </g>
            </svg>
          </div>
          <Legend />
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
/** Returns a circle's accessible name: its id label and title, with the marks that it wears. */
function nameCircle(label: string, title: string, marks: { isBlocked: boolean; isPick: boolean }): string {
  return `${label}: ${title}${marks.isBlocked ? ', blocked' : ''}${marks.isPick ? ', next pick' : ''}`;
}
// endregion | Helpers
