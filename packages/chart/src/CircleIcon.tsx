import type { ReactElement } from 'react';

import { RADIUS_PER_POINT } from './layout.ts';
import { UNSIZED_DOT_COUNT } from './ScoredCircle.tsx';

const STROKE_WIDTH = 2.5;
const BLOCKED_GAP = 1.5;
const SIZE = 2 * (RADIUS_PER_POINT + BLOCKED_GAP) + STROKE_WIDTH;

/**
 * A one-point item circle, drawn inline, with the done fill, the dotted border of an unsized item, and the blocked ring
 * when it has them; its border colour follows the nearest `data-work-type`.
 */
export function CircleIcon({
  isBlocked = false,
  isDone = false,
  isUnsized = false,
}: {
  isBlocked?: boolean;
  isDone?: boolean;
  isUnsized?: boolean;
}): ReactElement {
  return (
    <svg aria-hidden="true" className="tr-circle-icon" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE}>
      <circle
        className={isDone ? 'tr-circle tr-circle-done' : 'tr-circle'}
        cx={SIZE / 2}
        cy={SIZE / 2}
        data-sized={!isUnsized}
        pathLength={isUnsized ? UNSIZED_DOT_COUNT : undefined}
        r={RADIUS_PER_POINT}
      />
      {isBlocked ? (
        <circle className="tr-circle-blocked" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS_PER_POINT + BLOCKED_GAP} />
      ) : null}
    </svg>
  );
}
