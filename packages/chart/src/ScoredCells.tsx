import {
  classifyWorkType,
  deriveStatus,
  type ResolvedItemScores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import { Fragment, type ReactElement, type ReactNode } from 'react';

import { nameCircle } from './item-label.ts';
import type { CellLayout, ScopeMode } from './layout.ts';
import { PulsingCircle } from './PulsingCircle.tsx';
import { type Fade, ScoredCircle } from './ScoredCircle.tsx';
import type { DragHandlers } from './useItemDrag.ts';

export interface ScoredCellsProps {
  cells: readonly CellLayout[];
  itemsByKey: ReadonlyMap<string, WorkItem>;
  scores: Readonly<Record<string, ResolvedItemScores>>;
  overrides: Readonly<Record<string, StatusOverride>>;
  scopeMode: ScopeMode;
  workTypeMapping: WorkTypeMapping;
  labelOf: (item: WorkItem) => string;
  fadeOf: (key: string) => Fade | undefined;
  /** The keys of the items that an open item blocks. */
  blockedKeys: ReadonlySet<string>;
  /** The item that a relation row in the pane points at. */
  highlightedKey: string | undefined;
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
  fadeOf,
  blockedKeys,
  highlightedKey,
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
          <g key={`${cell.u},${cell.v}`}>
            {cell.circles.map((circle) => {
              const item = itemsByKey.get(circle.id);
              if (!item) return null;
              return (
                <Fragment key={circle.id}>
                  <ScoredCircle
                    cellX={cell.x}
                    cellY={cell.y}
                    circle={circle}
                    isBlocked={blockedKeys.has(circle.id)}
                    isHighlighted={circle.id === highlightedKey}
                    fade={fadeOf(circle.id)}
                    isSelected={circle.id === selectedKey}
                    dragHandlers={dragHandlersFor(circle.id, circle.r)}
                    isDragging={circle.id === draggingKey}
                    name={nameCircle(labelOf(item), item.title, { isBlocked: blockedKeys.has(circle.id) })}
                    onPreview={onPreview}
                    onSelect={onSelect}
                    progress={scores[circle.id]?.progress?.score ?? 0}
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

/** The pulsing copy of the scored circle of `pulseKey`, or nothing when that item has no circle in a scored cell. */
export function CirclePulseCopy({
  pulseKey,
  onEnd,
  cells,
  itemsByKey,
  scores,
  overrides,
  scopeMode,
  blockedKeys,
  workTypeMapping,
}: Pick<
  ScoredCellsProps,
  'cells' | 'itemsByKey' | 'scores' | 'overrides' | 'scopeMode' | 'blockedKeys' | 'workTypeMapping'
> & { pulseKey: string; onEnd: () => void }): ReactElement | null {
  const item = itemsByKey.get(pulseKey);
  for (const cell of cells) {
    const circle = cell.isGutter ? undefined : cell.circles.find((candidate) => candidate.id === pulseKey);
    if (!item || !circle) continue;
    return (
      <PulsingCircle
        isBlocked={blockedKeys.has(pulseKey)}
        isUnsized={circle.isUnsized}
        onEnd={onEnd}
        progress={scores[pulseKey]?.progress?.score ?? 0}
        r={circle.r}
        scopeMode={scopeMode}
        status={deriveStatus(item, overrides[pulseKey])}
        workType={classifyWorkType(item.labels, workTypeMapping)}
        x={cell.x + circle.cx}
        y={cell.y + circle.cy}
      />
    );
  }
  return null;
}
