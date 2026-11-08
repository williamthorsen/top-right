import {
  classifyWorkType,
  DEFAULT_WORK_TYPE_MAPPING,
  deriveStatus,
  formatItemKey,
  isAgentScored,
  type ItemScores,
  type Scores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';

import { DetailPane } from './DetailPane.tsx';
import { GutterCell } from './GutterCell.tsx';
import { type Abbreviations, labelItem } from './item-label.ts';
import { CELL_SIZE, GRID_SIZE, layoutCells, sizeCircle } from './layout.ts';
import { Legend } from './Legend.tsx';
import type { SettableStatus } from './PaneScores.tsx';
import { ReviewStrip } from './ReviewStrip.tsx';
import { ScoredCircle } from './ScoredCircle.tsx';
import { listTrails, Trail } from './Trail.tsx';
import { useReview } from './useReview.ts';

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
}

const NO_SCORES: Readonly<Record<string, ItemScores>> = {};
const NO_OVERRIDES: Readonly<Record<string, StatusOverride>> = {};

// -- Frame around the matrix, in chart units --
const MARGIN_LEFT = 44;
const MARGIN_TOP = 14;
const MARGIN_RIGHT = 14;
const AXIS_HEIGHT = 40;
const MATRIX_SIZE = CELL_SIZE * GRID_SIZE;
const WIDTH = MARGIN_LEFT + MATRIX_SIZE + MARGIN_RIGHT;
const HEIGHT = MARGIN_TOP + MATRIX_SIZE + AXIS_HEIGHT;
/** The gridline index, counted from the gutter side, that separates the gutter from the scores. */
const GUTTER_LINE = 1;
/** The gridline index that separates the low and high halves of each axis. */
const QUADRANT_LINE = 4;

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
}: ChartProps): ReactElement {
  const [selectedKey, setSelectedKey] = useState<string>();
  const [previewKey, setPreviewKey] = useState<string>();

  const itemsByKey = useMemo(() => new Map(items.map((item) => [formatItemKey(item), item])), [items]);
  const blockedKeys = useMemo(() => findBlockedKeys(items), [items]);
  const cells = useMemo(
    () =>
      layoutCells(
        items.map((item) => {
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
    [items, scores],
  );

  const shownKey = previewKey ?? selectedKey;
  const shownItem = shownKey === undefined ? undefined : itemsByKey.get(shownKey);
  const review = useReview({
    items,
    scores,
    selectedKey,
    setSelectedKey,
    setPreviewKey,
    onKeep,
    onScoresChange,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bring each item that a review moves to into view, since the chart scrolls on a narrow screen.
  useEffect(() => {
    if (review.kind === undefined || selectedKey === undefined) return;
    const element = scrollRef.current?.querySelector(`[data-item-key="${CSS.escape(selectedKey)}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [review.kind, selectedKey]);

  const trails = listTrails(
    cells,
    scores,
    (key) => review.kind === 'agent' || key === previewKey || key === selectedKey,
  );

  return (
    <div className="tr-root">
      <div className="tr-work">
        <div className="tr-chart-area">
          <ReviewStrip
            counts={{ agent: review.queues.agent.length, unscored: review.queues.unscored.length }}
            onEnd={review.end}
            onSkip={review.skip}
            onStart={review.start}
            running={review.kind === undefined ? undefined : { kind: review.kind, position: review.position }}
          />
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
                            isFaded={review.isFaded(circle.id)}
                            isSelected={circle.id === selectedKey}
                            key={circle.id}
                            name={`${labelItem(item, abbreviations)}: ${item.title}`}
                            onPreview={setPreviewKey}
                            onSelect={setSelectedKey}
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
                      abbreviations={abbreviations}
                      cell={cell}
                      isFaded={review.isFaded}
                      itemsByKey={itemsByKey}
                      key={`${cell.u},${cell.i}`}
                      onPreview={setPreviewKey}
                      onSelect={setSelectedKey}
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
        </div>
        <DetailPane
          abbreviations={abbreviations}
          blockedKeys={blockedKeys}
          isReviewing={review.kind !== undefined}
          item={shownItem}
          mode={previewKey !== undefined && previewKey !== selectedKey ? 'preview' : 'selected'}
          onClose={() => {
            setSelectedKey(undefined);
            setPreviewKey(undefined);
          }}
          onKeep={onKeep ? review.keep : undefined}
          onScoresChange={review.changeScores}
          onStatusChange={(itemKey, status) => {
            setSelectedKey(itemKey);
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
/** Returns the keys of the items that an open item blocks. */
function findBlockedKeys(items: readonly WorkItem[]): Set<string> {
  const blocked = new Set<string>();
  for (const item of items) {
    const isBlocked = item.relations.some(
      (relation) => relation.kind === 'blocked-by' && relation.ref.state === 'open',
    );
    if (isBlocked) blocked.add(formatItemKey(item));
  }
  return blocked;
}

function Grid() {
  const lines = Array.from({ length: GRID_SIZE + 1 }, (_, index) => index);
  const scores = Array.from({ length: GRID_SIZE }, (_, index) => index);
  const left = MARGIN_LEFT;
  const top = MARGIN_TOP;
  const bottom = MARGIN_TOP + MATRIX_SIZE;

  return (
    <g aria-hidden="true">
      {lines.map((index) => (
        <line
          className={lineClass(index)}
          key={`v${index}`}
          x1={left + index * CELL_SIZE}
          x2={left + index * CELL_SIZE}
          y1={top}
          y2={bottom}
        />
      ))}
      {lines.map((index) => (
        <line
          className={lineClass(GRID_SIZE - index)}
          key={`h${index}`}
          x1={left}
          x2={left + MATRIX_SIZE}
          y1={top + index * CELL_SIZE}
          y2={top + index * CELL_SIZE}
        />
      ))}
      {scores.map((score) => (
        <text
          className="tr-axis-label"
          key={`u${score}`}
          textAnchor="middle"
          x={left + (score + 0.5) * CELL_SIZE}
          y={bottom + 16}
        >
          {score === 0 ? 'unscored' : score}
        </text>
      ))}
      {scores.map((score) => (
        <text
          className="tr-axis-label"
          key={`i${score}`}
          textAnchor="middle"
          transform={score === 0 ? `translate(${left - 10} ${bottom - CELL_SIZE / 2}) rotate(-90)` : undefined}
          x={score === 0 ? 0 : left - 14}
          y={score === 0 ? 0 : bottom - (score + 0.5) * CELL_SIZE + 4}
        >
          {score === 0 ? 'unscored' : score}
        </text>
      ))}
      <text className="tr-axis-title" textAnchor="end" x={left + MATRIX_SIZE} y={bottom + 34}>
        Urgency →
      </text>
      <text className="tr-axis-title" transform={`translate(12 ${top}) rotate(-90)`} textAnchor="end" x={0} y={0}>
        Impact →
      </text>
    </g>
  );
}

/** Returns the class of the gridline at `index` along an axis, counted from the gutter side. */
function lineClass(index: number): string {
  if (index === GUTTER_LINE) return 'tr-gutterline';
  if (index === QUADRANT_LINE) return 'tr-quad';
  return 'tr-gridline';
}
// endregion | Helpers
