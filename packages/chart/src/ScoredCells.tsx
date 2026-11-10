import {
  classifyWorkType,
  deriveStatus,
  isAgentScored,
  type ItemScores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { Fragment, type ReactElement, type ReactNode } from 'react';

import { nameCircle } from './item-label.ts';
import type { CellLayout, ScopeMode } from './layout.ts';
import { ScoredCircle } from './ScoredCircle.tsx';
import type { DragHandlers } from './useItemDrag.ts';

export interface ScoredCellsProps {
  cells: readonly CellLayout[];
  itemsByKey: ReadonlyMap<string, WorkItem>;
  scores: Readonly<Record<string, ItemScores>>;
  overrides: Readonly<Record<string, StatusOverride>>;
  scopeMode: ScopeMode;
  workTypeMapping: WorkTypeMapping;
  labelOf: (item: WorkItem) => string;
  isFaded: (key: string) => boolean;
  /** The keys of the items that an open item blocks. */
  blockedKeys: ReadonlySet<string>;
  /** The item that a relation row in the pane points at. */
  highlightedKey: string | undefined;
  pickKey: string | undefined;
  selectedKey: string | undefined;
  /** Returns the handlers that let an item's circle be dragged, which only the selected item has. */
  dragHandlersFor: (key: string, r?: number) => DragHandlers | undefined;
  /** The item whose drag is in progress. */
  draggingKey: string | undefined;
  onPreview: (key: string | undefined) => void;
  onSelect: (key: string) => void;
  /** The item after whose circle the ghosts draw, so that they share its stacking; `ghosts` draws nowhere without one. */
  ghostOwner: string | undefined;
  ghosts: ReactNode;
}

/** The circles of the scored cells, each cell's circles in one group. */
export function ScoredCells({
  cells,
  itemsByKey,
  scores,
  overrides,
  scopeMode,
  workTypeMapping,
  labelOf,
  isFaded,
  blockedKeys,
  highlightedKey,
  pickKey,
  selectedKey,
  dragHandlersFor,
  draggingKey,
  onPreview,
  onSelect,
  ghostOwner,
  ghosts,
}: ScoredCellsProps): ReactElement {
  return (
    <>
      {cells.map((cell) =>
        cell.isGutter ? null : (
          <g key={`${cell.u},${cell.i}`}>
            {cell.circles.map((circle) => {
              const item = itemsByKey.get(circle.id);
              if (!item) return null;
              return (
                <Fragment key={circle.id}>
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
                    isDragging={circle.id === draggingKey}
                    name={nameCircle(labelOf(item), item.title, {
                      isBlocked: blockedKeys.has(circle.id),
                      isPick: circle.id === pickKey,
                    })}
                    onPreview={onPreview}
                    onSelect={onSelect}
                    progress={scores[circle.id]?.progress?.value ?? 0}
                    scopeMode={scopeMode}
                    status={deriveStatus(item, overrides[circle.id])}
                    workType={classifyWorkType(item.labels, workTypeMapping)}
                  />
                  {circle.id === ghostOwner ? ghosts : null}
                </Fragment>
              );
            })}
          </g>
        ),
      )}
    </>
  );
}
