import {
  deriveStatus,
  type Edge,
  type ItemRef,
  type ResolvedItemScores,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import type { ReactElement } from 'react';

import type { EdgeEnd } from './edge-path.ts';
import { listEdgeEnds } from './Edges.tsx';
import { GhostCircle } from './GhostCircle.tsx';
import {
  type CellLayout,
  findItemCell,
  type GhostPlacement,
  placeGhosts,
  type Placement,
  type ScopeMode,
  sizeItem,
} from './layout.ts';

export interface GhostsProps {
  ghosts: readonly GhostPlacement[];
  isFaded: (key: string) => boolean;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
  onReveal: (key: string) => void;
}

/** What the board needs to know to draw edges and ghosts. */
interface GhostBoard {
  itemsByKey: ReadonlyMap<string, WorkItem>;
  overrides: Readonly<Record<string, StatusOverride>>;
  scores: Readonly<Record<string, ResolvedItemScores>>;
  /** The scope that circle areas show, which a ghost's area follows. */
  scopeMode: ScopeMode;
  visibleKeys: ReadonlySet<string>;
}

/** The ghosts of the hidden done items at the ends of the shown edges. */
export function Ghosts({ ghosts, isFaded, itemsByKey, labelOf, onReveal }: GhostsProps): ReactElement {
  return (
    <>
      {ghosts.map((ghost) => {
        const item = itemsByKey.get(ghost.id);
        if (!item) return null;
        return (
          <GhostCircle
            ghost={ghost}
            isFaded={isFaded(ghost.id)}
            key={ghost.id}
            name={`${labelOf(item)}: ${item.title}, done, hidden`}
            onReveal={onReveal}
          />
        );
      })}
    </>
  );
}

/**
 * Places the ghosts of the edges shown for `focusKey`, and returns them with every edge end and the circle that the
 * ghosts follow in the DOM, so that Tab moves from that circle to them; without one, they follow every circle.
 */
export function layoutGhosts(
  cells: readonly CellLayout[],
  edges: readonly Edge[],
  focusKey: string | undefined,
  board: GhostBoard,
  cellSize: number,
): { ends: Map<string, EdgeEnd>; ghosts: GhostPlacement[]; ghostOwner: string | undefined } {
  const ends = listEdgeEnds(cells);
  const ghosts = placeGhosts(cells, listGhostPlacements(edges, { ...board, matrixKeys: ends }), cellSize);
  const ghostOwner = focusKey !== undefined && ends.has(focusKey) ? focusKey : undefined;
  for (const ghost of ghosts) ends.set(ghost.id, ghost);
  return { ends, ghosts, ghostOwner };
}

/**
 * Returns a placement for each end of `edges` that is a loaded, scored done item that the filter hides and whose other
 * end is a circle in the matrix, since only such an edge is drawn.
 */
export function listGhostPlacements(
  edges: readonly Edge[],
  board: GhostBoard & {
    /** The keys of the items drawn as circles in the matrix. */
    matrixKeys: ReadonlySet<string> | ReadonlyMap<string, unknown>;
  },
): Placement[] {
  const { itemsByKey, matrixKeys, overrides, scopeMode, scores, visibleKeys } = board;
  const farEnds = edges.flatMap((edge) => [
    ...(matrixKeys.has(edge.from) ? [edge.to] : []),
    ...(matrixKeys.has(edge.to) ? [edge.from] : []),
  ]);
  return new Set(farEnds)
    .values()
    .flatMap((key): Placement[] => {
      const item = itemsByKey.get(key);
      const itemScores = scores[key];
      const { u, v } = findItemCell(itemScores);
      if (!item || visibleKeys.has(key) || u === 0 || v === 0) return [];
      if (deriveStatus(item, overrides[key]) !== 'done') return [];
      return [{ id: key, u, v, ...sizeItem(itemScores, scopeMode) }];
    })
    .toArray();
}
