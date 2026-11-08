import {
  classifyWorkType,
  DEFAULT_WORK_TYPE_MAPPING,
  formatItemKey,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, useEffect, useMemo, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { DetailPane } from './DetailPane.tsx';
import { type Abbreviations, labelItem } from './item-label.ts';
import { CELL_SIZE, type CellLayout, GRID_SIZE, layoutCells } from './layout.ts';
import { Legend } from './Legend.tsx';

import './chart.css';

export interface ChartProps {
  items: readonly WorkItem[];
  /** Repository abbreviations keyed by `owner/name`; a repository without one takes its first letter. */
  abbreviations: Abbreviations;
  workTypeMapping?: WorkTypeMapping;
}

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
export function Chart({ items, abbreviations, workTypeMapping = DEFAULT_WORK_TYPE_MAPPING }: ChartProps): ReactElement {
  const [selectedKey, setSelectedKey] = useState<string>();
  const [previewKey, setPreviewKey] = useState<string>();

  const itemsByKey = useMemo(() => new Map(items.map((item) => [formatItemKey(item), item])), [items]);
  const blockedKeys = useMemo(() => findBlockedKeys(items), [items]);
  // Scores do not exist yet, so every item is unscored on both axes.
  const cells = useMemo(() => layoutCells(items.map((item) => ({ id: formatItemKey(item), u: 0, i: 0 }))), [items]);

  useEffect(() => {
    function clearOnEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setSelectedKey(undefined);
      setPreviewKey(undefined);
    }
    document.addEventListener('keydown', clearOnEscape);
    return () => document.removeEventListener('keydown', clearOnEscape);
  }, []);

  const shownKey = previewKey ?? selectedKey;
  const shownItem = shownKey === undefined ? undefined : itemsByKey.get(shownKey);

  return (
    <div className="tr-root">
      <div className="tr-work">
        <div className="tr-chart-area">
          <div className="tr-chart-scroll">
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
                {cells.map((cell) =>
                  cell.isGutter ? (
                    <GutterCell
                      abbreviations={abbreviations}
                      cell={cell}
                      itemsByKey={itemsByKey}
                      key={`${cell.u},${cell.i}`}
                      onPreview={setPreviewKey}
                      onSelect={setSelectedKey}
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
          item={shownItem}
          mode={previewKey !== undefined && previewKey !== selectedKey ? 'preview' : 'selected'}
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

interface GutterCellProps {
  cell: CellLayout;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  abbreviations: Abbreviations;
  workTypeMapping: WorkTypeMapping;
  selectedKey: string | undefined;
  onPreview: (key: string | undefined) => void;
  onSelect: (key: string) => void;
}

/** A gutter cell's list of items, which scrolls within the cell when it is taller than the cell. */
function GutterCell({
  cell,
  itemsByKey,
  abbreviations,
  workTypeMapping,
  selectedKey,
  onPreview,
  onSelect,
}: GutterCellProps) {
  return (
    <foreignObject height={CELL_SIZE} width={CELL_SIZE} x={cell.x} y={cell.y}>
      <ul aria-label="Unscored items" className="tr-gutter-list" data-overflow={cell.overflow}>
        {cell.ids.map((key) => {
          const item = itemsByKey.get(key);
          if (!item) return null;
          const label = labelItem(item, abbreviations);
          return (
            <li data-work-type={classifyWorkType(item.labels, workTypeMapping)} key={key}>
              <button
                aria-label={`${label}: ${item.title}`}
                aria-pressed={key === selectedKey}
                className="tr-item"
                onBlur={() => onPreview(undefined)}
                onClick={() => onSelect(key)}
                onFocus={() => onPreview(key)}
                onPointerEnter={() => onPreview(key)}
                onPointerLeave={() => onPreview(undefined)}
                type="button"
              >
                <CircleIcon />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </foreignObject>
  );
}

/** Returns the class of the gridline at `index` along an axis, counted from the gutter side. */
function lineClass(index: number): string {
  if (index === GUTTER_LINE) return 'tr-gutterline';
  if (index === QUADRANT_LINE) return 'tr-quad';
  return 'tr-gridline';
}
// endregion | Helpers
