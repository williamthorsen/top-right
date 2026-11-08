import type { ReactElement } from 'react';

import { FLOOR_RADIUS } from './layout.ts';

const STROKE_WIDTH = 2.5;
const SIZE = 2 * FLOOR_RADIUS + STROKE_WIDTH;

/** A floor-sized item circle, drawn inline; its border colour follows the nearest `data-work-type`. */
export function CircleIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tr-circle-icon" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE}>
      <circle className="tr-circle" cx={SIZE / 2} cy={SIZE / 2} r={FLOOR_RADIUS} />
    </svg>
  );
}
