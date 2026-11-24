import {
  classifyWorkType,
  deriveStatus,
  type Edge,
  type ItemRef,
  type ResolvedItemScores,
  type StatusOverride,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import type { EdgeEnd } from './edge-path.ts';
import { listEdgeEnds } from './Edges.tsx';
import { GhostCircle, type GhostStatus } from './GhostCircle.tsx';
import {
  type CellLayout,
  findItemCell,
  type GhostPlacement,
  placeGhosts,
  type Placement,
  type ScopeMode,
  sizeItem,
} from './layout.ts';
import type { Fade } from './ScoredCircle.tsx';
import { STATUS_NAMES } from './status-names.ts';

export interface GhostsProps {
  fadeOf: (key: string) => Fade | undefined;
  ghosts: readonly Ghost[];
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
  onReveal: (key: string) => void;
  workTypeMapping: WorkTypeMapping;
}

/** A ghost's circle in the matrix, with the status of its item, which decides how the circle is drawn. */
export interface Ghost extends GhostPlacement {
  status: GhostStatus;
}

/** What the board needs to know to draw edges and ghosts. */
export interface GhostBoard {
  itemsByKey: ReadonlyMap<string, WorkItem>;
  overrides: Readonly<Record<string, StatusOverride>>;
  scores: Readonly<Record<string, ResolvedItemScores>>;
  /** The scope that circle areas show, which a ghost's area follows. */
  scopeMode: ScopeMode;
  /** The repositories that the filter shows, or undefined for every repository; only their items take ghosts. */
  shownRepos: ReadonlySet<string> | undefined;
  visibleKeys: ReadonlySet<string>;
}

/** The ghosts of the hidden done and backlog items at the ends of the shown edges. */
export function Ghosts({ fadeOf, ghosts, itemsByKey, labelOf, onReveal, workTypeMapping }: GhostsProps): ReactElement {
  return (
    <>
      {ghosts.map((ghost) => {
        const item = itemsByKey.get(ghost.id);
        if (!item) return null;
        return (
          <GhostCircle
            ghost={ghost}
            fade={fadeOf(ghost.id)}
            key={ghost.id}
            name={`${labelOf(item)}: ${item.title}, ${STATUS_NAMES[ghost.status].toLowerCase()}, hidden`}
            onReveal={onReveal}
            status={ghost.status}
            workType={classifyWorkType(item.labels, workTypeMapping)}
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
): { ends: Map<string, EdgeEnd>; ghosts: Ghost[]; ghostOwner: string | undefined } {
  const ends = listEdgeEnds(cells);
  const placements = listGhostPlacements(edges, { ...board, matrixKeys: ends });
  const statusOf = new Map(placements.map(({ id, status }) => [id, status]));
  const ghosts = placeGhosts(cells, placements, cellSize).flatMap((ghost): Ghost[] => {
    const status = statusOf.get(ghost.id);
    return status === undefined ? [] : [{ ...ghost, status }];
  });
  const ghostOwner = focusKey !== undefined && ends.has(focusKey) ? focusKey : undefined;
  for (const ghost of ghosts) ends.set(ghost.id, ghost);
  return { ends, ghosts, ghostOwner };
}

/**
 * Returns a placement, with its item's status, for each end of `edges` that is a loaded, scored done or backlog item in
 * a shown repository that the filter hides and whose other end is a circle in the matrix, since only such an edge is
 * drawn.
 */
export function listGhostPlacements(
  edges: readonly Edge[],
  board: GhostBoard & {
    /** The keys of the items drawn as circles in the matrix. */
    matrixKeys: ReadonlySet<string> | ReadonlyMap<string, unknown>;
  },
): Array<Placement & { status: GhostStatus }> {
  const { itemsByKey, matrixKeys, overrides, scopeMode, scores, shownRepos, visibleKeys } = board;
  const farEnds = edges.flatMap((edge) => [
    ...(matrixKeys.has(edge.from) ? [edge.to] : []),
    ...(matrixKeys.has(edge.to) ? [edge.from] : []),
  ]);
  return new Set(farEnds)
    .values()
    .flatMap((key): Array<Placement & { status: GhostStatus }> => {
      const item = itemsByKey.get(key);
      const itemScores = scores[key];
      const { u, v } = findItemCell(itemScores);
      if (!item || visibleKeys.has(key) || u === 0 || v === 0) return [];
      if (shownRepos !== undefined && !shownRepos.has(item.repo)) return [];
      const status = deriveStatus(item, overrides[key]);
      if (status !== 'done' && status !== 'backlog') return [];
      return [{ id: key, u, v, status, ...sizeItem(itemScores, scopeMode) }];
    })
    .toArray();
}
