import {
  classifyWorkType,
  isAgentScored,
  type ItemScores,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { CELL_SIZE, type CellLayout } from './layout.ts';
import type { DragHandlers } from './useItemDrag.ts';

export interface GutterCellProps {
  cell: CellLayout;
  scores: Readonly<Record<string, ItemScores>>;
  isFaded: (key: string) => boolean;
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
  /** Where the matrix's origin sits in the SVG; the cell's coordinates are relative to it. */
  origin: { x: number; y: number };
  /** Returns the handlers that let an item's row be dragged, which only the selected item has. */
  dragHandlersFor: (key: string) => DragHandlers | undefined;
  /** The item whose drag is in progress. */
  draggingKey: string | undefined;
}

/** A gutter cell's list of items, which scrolls within the cell when it is taller than the cell. */
export function GutterCell({
  cell,
  scores,
  isFaded,
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
  // A transformed ancestor would offset WebKit's painting and hit testing of the scrolling list from its layout.
  return (
    <foreignObject height={CELL_SIZE} width={CELL_SIZE} x={origin.x + cell.x} y={origin.y + cell.y}>
      <ul aria-label="Unscored items" className="tr-gutter-list" data-overflow={cell.overflow}>
        {cell.ids.map((key) => {
          const item = itemsByKey.get(key);
          if (!item) return null;
          const label = labelOf(item);
          const isBlocked = blockedKeys.has(key);
          return (
            <li
              data-faded={isFaded(key) && key !== selectedKey}
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
                <CircleIcon hasHalo={isAgentScored(scores[key])} isBlocked={isBlocked} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </foreignObject>
  );
}
