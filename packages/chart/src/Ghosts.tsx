import {
  deriveStatus,
  type Edge,
  type ItemRef,
  type ItemScores,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { GhostCircle } from './GhostCircle.tsx';
import { type GhostPlacement, type Placement, sizeCircle } from './layout.ts';

export interface GhostsProps {
  ghosts: readonly GhostPlacement[];
  isFaded: (key: string) => boolean;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
  onReveal: (key: string) => void;
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

/** Returns a placement for each end of `edges` that is a loaded, scored done item that the filter hides. */
export function listGhostPlacements(
  edges: readonly Edge[],
  board: {
    itemsByKey: ReadonlyMap<string, WorkItem>;
    overrides: Readonly<Record<string, StatusOverride>>;
    scores: Readonly<Record<string, ItemScores>>;
    visibleKeys: ReadonlySet<string>;
  },
): Placement[] {
  const { itemsByKey, overrides, scores, visibleKeys } = board;
  return new Set(edges.flatMap((edge) => [edge.from, edge.to]))
    .values()
    .flatMap((key): Placement[] => {
      const item = itemsByKey.get(key);
      const itemScores = scores[key];
      const u = itemScores?.urgency?.value;
      const i = itemScores?.impact?.value;
      if (!item || visibleKeys.has(key) || u === undefined || i === undefined) return [];
      if (deriveStatus(item, overrides[key]) !== 'done') return [];
      return [{ id: key, u, i, ...sizeCircle(itemScores?.effort?.value) }];
    })
    .toArray();
}
