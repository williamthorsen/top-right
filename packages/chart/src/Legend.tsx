import { MAPPED_WORK_TYPES, type WorkType } from '@top-right/model';
import type { ReactElement } from 'react';

import { CircleIcon } from './CircleIcon.tsx';

export const WORK_TYPE_NAMES: Record<WorkType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  none: 'Unmapped',
  ops: 'Ops',
  task: 'Task',
};

const LEGEND_TYPES: readonly WorkType[] = [...MAPPED_WORK_TYPES, 'none'];

/** The strip under the chart that names each work type's border. */
export function Legend(): ReactElement {
  return (
    <ul aria-label="Work type" className="tr-legend">
      {LEGEND_TYPES.map((workType) => (
        <li data-work-type={workType} key={workType}>
          <CircleIcon />
          {WORK_TYPE_NAMES[workType]}
        </li>
      ))}
    </ul>
  );
}
