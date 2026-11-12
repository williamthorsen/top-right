import { type Cell, findTrailOrigin, rankLevel, type ResolvedItemScores } from '@top-right/model';
import type { ReactElement } from 'react';

import { type CellLayout, GRID_SIZE } from './layout.ts';

export interface TrailProps {
  /** The cell from which the agent moved the item. */
  origin: Cell;
  /** The circle's centre in the matrix. */
  x: number;
  y: number;
  r: number;
  cellSize: number;
}

/** A dashed outline of the circle at the centre of its previous cell, joined by a dashed line to where it is now. */
export function Trail({ origin, x, y, r, cellSize }: TrailProps): ReactElement {
  const originX = (rankLevel(origin.urgency) + 0.5) * cellSize;
  const originY = (GRID_SIZE - 1 - rankLevel(origin.value) + 0.5) * cellSize;
  return (
    <g aria-hidden="true" className="tr-trail">
      <circle cx={originX} cy={originY} r={r} />
      <line x1={originX} x2={x} y1={originY} y2={y} />
    </g>
  );
}

/** Returns a trail for each circle that the agent moved within the matrix and for which `isShown` holds. */
export function listTrails(
  cells: readonly CellLayout[],
  scores: Readonly<Record<string, ResolvedItemScores>>,
  isShown: (key: string) => boolean,
): Array<Omit<TrailProps, 'cellSize'> & { id: string }> {
  const trails: Array<Omit<TrailProps, 'cellSize'> & { id: string }> = [];
  for (const cell of cells) {
    for (const circle of cell.circles) {
      const origin = isShown(circle.id) ? findTrailOrigin(scores[circle.id]) : undefined;
      if (origin) trails.push({ id: circle.id, origin, x: cell.x + circle.cx, y: cell.y + circle.cy, r: circle.r });
    }
  }
  return trails;
}
