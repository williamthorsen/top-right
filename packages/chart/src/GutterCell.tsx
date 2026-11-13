import {
  classifyWorkType,
  isAgentScored,
  type ResolvedItemScores,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import type { CellLayout } from './layout.ts';
import type { Fade } from './ScoredCircle.tsx';
import type { DragHandlers } from './useItemDrag.ts';

export interface GutterCellProps {
  cell: CellLayout;
  cellSize: number;
  scores: Readonly<Record<string, ResolvedItemScores>>;
  fadeOf: (key: string) => Fade | undefined;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (item: WorkItem) => string;
  workTypeMapping: WorkTypeMapping;
  selectedKey: string | undefined;
  /** The keys of the items that an open item blocks. */
  blockedKeys: ReadonlySet<string>;
  /** The item that a relation row in the pane points at. */
  highlightedKey: string | undefined;
  onPreview: (key: string | undefined) => void;
  onSelect: (key: string) => void;
  /** Where the matrix's origin sits in the chart, in chart units; the cell's coordinates are relative to it. */
  origin: { x: number; y: number };
  /** Returns the handlers that let an item's row be dragged, which only the selected item has. */
  dragHandlersFor: (key: string) => DragHandlers | undefined;
  /** The item whose drag is in progress. */
  draggingKey: string | undefined;
}

/**
 * A gutter cell's list of items, which scrolls within the cell when it is taller than the cell. It is positioned in
 * chart units within the layer of gutter cells over the chart.
 */
export function GutterCell({
  cell,
  cellSize,
  scores,
  fadeOf,
  itemsByKey,
  labelOf,
  workTypeMapping,
  selectedKey,
  blockedKeys,
  highlightedKey,
  onPreview,
  onSelect,
  origin,
  dragHandlersFor,
  draggingKey,
}: GutterCellProps): ReactElement {
  return (
    <div
      className="tr-gutter-cell"
      style={{ left: origin.x + cell.x, top: origin.y + cell.y, width: cellSize, height: cellSize }}
    >
      <ul aria-label="Unscored items" className="tr-gutter-list" data-overflow={cell.overflow}>
        {cell.ids.map((key) => {
          const item = itemsByKey.get(key);
          if (!item) return null;
          const label = labelOf(item);
          const isBlocked = blockedKeys.has(key);
          return (
            <li
              data-fade={key === selectedKey ? undefined : fadeOf(key)}
              data-work-type={classifyWorkType(item.labels, workTypeMapping)}
              key={key}
            >
              <button
                aria-label={`${label}: ${item.title}${isBlocked ? ', blocked' : ''}`}
                aria-pressed={key === selectedKey}
                data-item-key={key}
                className="tr-item"
                data-dragging={key === draggingKey}
                data-highlighted={key === highlightedKey}
                onBlur={() => onPreview(undefined)}
                onClick={() => onSelect(key)}
                onFocus={() => onPreview(key)}
                onPointerEnter={() => onPreview(key)}
                onPointerLeave={() => onPreview(undefined)}
                type="button"
                {...dragHandlersFor(key)}
              >
                <CircleIcon
                  hasHalo={isAgentScored(scores[key])}
                  isBlocked={isBlocked}
                  isDone={item.state === 'closed'}
                />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
