import { type Cell, findTrailOrigin, type ItemScores } from '@top-right/model';
import type { ReactElement } from 'react';

import { CELL_SIZE, type CellLayout, GRID_SIZE } from './layout.ts';

export interface TrailProps {
  /** The cell from which the agent moved the item. */
  origin: Cell;
  /** The circle's centre in the matrix. */
  x: number;
  y: number;
  r: number;
}

/** A dashed outline of the circle at the centre of its previous cell, joined by a dashed line to where it is now. */
export function Trail({ origin, x, y, r }: TrailProps): ReactElement {
  const originX = (origin.urgency + 0.5) * CELL_SIZE;
  const originY = (GRID_SIZE - 1 - origin.impact + 0.5) * CELL_SIZE;
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
  scores: Readonly<Record<string, ItemScores>>,
  isShown: (key: string) => boolean,
): Array<TrailProps & { id: string }> {
  const trails: Array<TrailProps & { id: string }> = [];
  for (const cell of cells) {
    for (const circle of cell.circles) {
      const origin = isShown(circle.id) ? findTrailOrigin(scores[circle.id]) : undefined;
      if (origin) trails.push({ id: circle.id, origin, x: cell.x + circle.cx, y: cell.y + circle.cy, r: circle.r });
    }
  }
  return trails;
}
