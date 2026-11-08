import type { ReactElement } from 'react';

import { FLOOR_RADIUS } from './layout.ts';

const STROKE_WIDTH = 2.5;
const HALO_GAP = 3.5;
const SIZE = 2 * (FLOOR_RADIUS + HALO_GAP) + STROKE_WIDTH;

/**
 * A floor-sized item circle, drawn inline, with the agent's halo and the blocked ring when it has them; its border
 * colour follows the nearest `data-work-type`.
 */
export function CircleIcon({
  hasHalo = false,
  isBlocked = false,
}: {
  hasHalo?: boolean;
  isBlocked?: boolean;
}): ReactElement {
  return (
    <svg aria-hidden="true" className="tr-circle-icon" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE}>
      <circle className="tr-circle" cx={SIZE / 2} cy={SIZE / 2} r={FLOOR_RADIUS} />
      {isBlocked ? <circle className="tr-circle-blocked" cx={SIZE / 2} cy={SIZE / 2} r={FLOOR_RADIUS + 1.5} /> : null}
      {hasHalo ? <circle className="tr-circle-halo" cx={SIZE / 2} cy={SIZE / 2} r={FLOOR_RADIUS + HALO_GAP} /> : null}
    </svg>
  );
}
