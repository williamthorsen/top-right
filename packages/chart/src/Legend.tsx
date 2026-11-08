import { MAPPED_WORK_TYPES, type WorkType } from '@top-right/model';
import type { ReactElement } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { FLOOR_RADIUS } from './layout.ts';

export const WORK_TYPE_NAMES: Record<WorkType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  none: 'Unmapped',
  ops: 'Ops',
  task: 'Task',
};

const LEGEND_TYPES: readonly WorkType[] = [...MAPPED_WORK_TYPES, 'none'];

/** The radius of a status swatch, a little larger than the floor so that its pie and floor mark read. */
const SWATCH_RADIUS = FLOOR_RADIUS + 1.5;
const SWATCH_SIZE = 2 * SWATCH_RADIUS + 3;

/** The strip under the chart that names each status fill, the floor mark, and each work type's border. */
export function Legend(): ReactElement {
  return (
    <div className="tr-legends">
      <ul aria-label="Status" className="tr-legend">
        <li>
          <StatusSwatch status="to-do" />
          To do
        </li>
        <li>
          <StatusSwatch status="in-progress" />
          In progress
        </li>
        <li>
          <StatusSwatch isFloored status="to-do" />
          Unsized, at the floor
        </li>
      </ul>
      <ul aria-label="Work type" className="tr-legend">
        {LEGEND_TYPES.map((workType) => (
          <li data-work-type={workType} key={workType}>
            <CircleIcon />
            {WORK_TYPE_NAMES[workType]}
          </li>
        ))}
      </ul>
    </div>
  );
}

// region | Helpers
/** A circle drawn as the chart draws a scored item of `status`; an in-progress swatch shows a pie of two-thirds. */
function StatusSwatch({ status, isFloored = false }: { status: 'in-progress' | 'to-do'; isFloored?: boolean }) {
  const r = SWATCH_RADIUS;
  return (
    <svg aria-hidden="true" height={SWATCH_SIZE} viewBox={`0 0 ${SWATCH_SIZE} ${SWATCH_SIZE}`} width={SWATCH_SIZE}>
      <g className="tr-node" data-status={status} transform={`translate(${SWATCH_SIZE / 2} ${SWATCH_SIZE / 2})`}>
        <circle className="tr-node-main" r={r} />
        {status === 'in-progress' ? (
          <path
            className="tr-node-pie"
            d={`M0 0 L0 ${-r} A${r} ${r} 0 1 1 ${(-r * Math.sin(Math.PI / 3)).toFixed(2)} ${(r / 2).toFixed(2)} Z`}
          />
        ) : null}
        <circle className="tr-node-border" r={r} />
        {isFloored ? <circle className="tr-node-floor" r={r - 3.5} /> : null}
      </g>
    </svg>
  );
}
// endregion | Helpers
