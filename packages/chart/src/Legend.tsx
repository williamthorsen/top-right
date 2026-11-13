import {
  MAPPED_WORK_TYPES,
  type StatusCategory,
  WORK_TYPE_NAMES,
  type WorkType,
  type WorkTypeMapping,
} from '@top-right/model';
import { type CSSProperties, type ReactElement, type ToggleEvent, useId, useRef, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { FLOOR_RADIUS } from './layout.ts';
import { STATUS_NAMES } from './status-names.ts';

const LEGEND_TYPES: readonly WorkType[] = [...MAPPED_WORK_TYPES, 'none'];

/** The radius of a status swatch, a little larger than the floor so that its pie and floor mark read. */
const SWATCH_RADIUS = FLOOR_RADIUS + 1.5;
const SWATCH_SIZE = 2 * SWATCH_RADIUS + 3;
/** The pick ring's gap in the legend, tighter than on the chart so that the swatch keeps the strip's height. */
const PICK_SWATCH_GAP = 4.5;
/** The space between the Mapping button and the popover above it, in pixels. */
const POPOVER_GAP = 6;

export interface LegendProps {
  workTypeMapping: WorkTypeMapping;
  /** Where the Settings page is; without it, the mapping popover does not link to Settings. */
  settingsHref?: string | undefined;
}

/**
 * The strip under the chart that names each status fill, the floor mark, each work type's border, and each relation
 * mark, with a popover that lists the labels of each work type.
 */
export function Legend({ workTypeMapping, settingsHref }: LegendProps): ReactElement {
  return (
    <div className="tr-legends">
      <ul aria-label="Status" className="tr-legend">
        <li>
          <StatusSwatch status="to-do" />
          {STATUS_NAMES['to-do']}
        </li>
        <li>
          <StatusSwatch status="in-progress" />
          {STATUS_NAMES['in-progress']}
        </li>
        <li>
          <StatusSwatch status="done" />
          {STATUS_NAMES.done}
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
        <li>
          <MappingPopover settingsHref={settingsHref} workTypeMapping={workTypeMapping} />
        </li>
      </ul>
      <ul aria-label="Relations" className="tr-legend">
        <li>
          <EdgeSwatch kind="blocker" />
          Blocks
        </li>
        <li>
          <EdgeSwatch kind="sub-issue" />
          Sub-issue
        </li>
        <li>
          <RingSwatch ring="blocked" />
          Blocked
        </li>
        <li>
          <RingSwatch ring="pick" />
          Next pick
        </li>
      </ul>
    </div>
  );
}

/** A circle drawn as the chart draws a scored item of `status`; an in-progress swatch shows a pie of two-thirds. */
export function StatusSwatch({
  status,
  isFloored = false,
}: {
  status: StatusCategory;
  isFloored?: boolean;
}): ReactElement {
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

// region | Helpers
/** The Mapping button and the popover that it opens above itself, listing each work type's labels. */
function MappingPopover({ workTypeMapping, settingsHref }: LegendProps) {
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  function followToggle(event: ToggleEvent<HTMLDivElement>): void {
    const opening = event.newState === 'open';
    setIsOpen(opening);
    const button = buttonRef.current;
    if (!opening || !button) return;
    const rect = button.getBoundingClientRect();
    setPosition({ left: rect.left, bottom: window.innerHeight - rect.top + POPOVER_GAP });
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        className="tr-legend-button"
        popoverTarget={popoverId}
        ref={buttonRef}
        type="button"
      >
        Mapping
      </button>
      <div
        aria-label="Work type mapping"
        className="tr-mapping-popover"
        id={popoverId}
        onToggle={followToggle}
        popover="auto"
        role="dialog"
        style={position}
      >
        <dl className="tr-mapping-list">
          {MAPPED_WORK_TYPES.map((workType) => (
            <div key={workType}>
              <dt data-work-type={workType}>
                <CircleIcon />
                {WORK_TYPE_NAMES[workType]}
              </dt>
              <dd>{workTypeMapping[workType].length > 0 ? workTypeMapping[workType].join(', ') : 'No labels'}</dd>
            </div>
          ))}
        </dl>
        {settingsHref === undefined ? null : <a href={settingsHref}>Edit in Settings</a>}
      </div>
    </>
  );
}

/** A short edge as the chart draws it: a blocker with its arrowhead, or a sub-issue line without one. */
function EdgeSwatch({ kind }: { kind: 'blocker' | 'sub-issue' }) {
  const width = 26;
  return (
    <svg aria-hidden="true" height={SWATCH_SIZE} viewBox={`0 0 ${width} ${SWATCH_SIZE}`} width={width}>
      <g className="tr-edge" data-kind={kind} data-weight="direct">
        <path
          className="tr-edge-line"
          d={`M2 ${SWATCH_SIZE / 2} L${width - (kind === 'blocker' ? 8 : 2)} ${SWATCH_SIZE / 2}`}
        />
        {kind === 'blocker' ? (
          <path
            className="tr-edge-arrow"
            d={`M${width - 8} ${SWATCH_SIZE / 2 - 4} L${width} ${SWATCH_SIZE / 2} L${width - 8} ${SWATCH_SIZE / 2 + 4} Z`}
          />
        ) : null}
      </g>
    </svg>
  );
}

/** A to-do circle wearing the blocked ring or the pick ring. */
function RingSwatch({ ring }: { ring: 'blocked' | 'pick' }) {
  const r = FLOOR_RADIUS;
  const size = 2 * (r + PICK_SWATCH_GAP) + 4;
  return (
    <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      <g className="tr-node" data-status="to-do" transform={`translate(${size / 2} ${size / 2})`}>
        <circle className="tr-node-main" r={r} />
        <circle className="tr-node-border" r={r} />
        {ring === 'blocked' ? (
          <circle className="tr-node-blocked" r={r + 1.5} />
        ) : (
          <circle className="tr-node-pick" r={r + PICK_SWATCH_GAP} />
        )}
      </g>
    </svg>
  );
}

// endregion | Helpers
