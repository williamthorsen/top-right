import type { StatusCategory, WorkType } from '@top-right/model';
import type { KeyboardEvent, ReactElement } from 'react';

import type { PlacedCircle } from './layout.ts';

export interface ScoredCircleProps {
  circle: PlacedCircle;
  /** The top-left corner of the circle's cell in the matrix. */
  cellX: number;
  cellY: number;
  /** The accessible name and the tooltip: the id label and the title. */
  name: string;
  workType: WorkType;
  status: StatusCategory;
  /** The fraction of the work done, 0 when unscored. */
  progress: number;
  isSelected: boolean;
  /** Whether the item carries an agent's score that the author has not kept, which its halo marks. */
  isAgentScored: boolean;
  /** Whether a review fades the circle; it stays selectable. */
  isFaded: boolean;
  onPreview: (id: string | undefined) => void;
  onSelect: (id: string) => void;
}

/** The smallest radius that a circle's hit target takes: 12 units is 24 px at 1×, the WCAG 2.2 target size. */
const HIT_RADIUS = 12;
/** How far the agent's halo sits outside the circle, clear of the selection and focus rings. */
const HALO_GAP = 9;
/** The thinnest wedge that an in-progress pie draws, so that a nearly finished item still reads as in progress. */
const MIN_WEDGE = Math.PI / 6;

/** A scored item's circle in its cell: fill by status, border by work type, a pie for the work that remains. */
export function ScoredCircle({
  circle,
  cellX,
  cellY,
  name,
  workType,
  status,
  progress,
  isSelected,
  isAgentScored,
  isFaded,
  onPreview,
  onSelect,
}: ScoredCircleProps): ReactElement {
  const { id, r } = circle;

  function selectOnKey(event: KeyboardEvent<SVGGElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  }

  return (
    <g
      aria-label={name}
      aria-pressed={isSelected}
      className="tr-node"
      data-faded={isFaded && !isSelected}
      data-status={status}
      data-work-type={workType}
      onBlur={() => onPreview(undefined)}
      onClick={() => onSelect(id)}
      onFocus={() => onPreview(id)}
      onKeyDown={selectOnKey}
      onPointerEnter={() => onPreview(id)}
      onPointerLeave={() => onPreview(undefined)}
      role="button"
      tabIndex={0}
      transform={`translate(${cellX + circle.cx} ${cellY + circle.cy})`}
    >
      <title>{name}</title>
      <circle className="tr-node-hit" r={Math.max(r, HIT_RADIUS)} />
      {isAgentScored ? <circle className="tr-node-halo" r={r + HALO_GAP} /> : null}
      <circle className="tr-node-main" r={r} />
      {status === 'in-progress' ? <Pie r={r} remaining={1 - progress} /> : null}
      <circle className="tr-node-border" r={r} />
      {circle.floored ? <circle className="tr-node-floor" r={Math.max(2, r - 3.5)} /> : null}
      <circle className="tr-node-selected" r={r + 3} />
      <circle className="tr-node-focus" r={r + 5.5} />
    </g>
  );
}

// region | Helpers
/** The solid pie of the remaining fraction, clockwise from twelve, never thinner than `MIN_WEDGE`. */
function Pie({ r, remaining }: { r: number; remaining: number }) {
  if (remaining >= 1) return <circle className="tr-node-pie" r={r} />;
  const angle = Math.max(MIN_WEDGE, Math.min(2 * Math.PI - 0.0001, remaining * 2 * Math.PI));
  const x = Math.sin(angle) * r;
  const y = -Math.cos(angle) * r;
  const largeArc = angle > Math.PI ? 1 : 0;
  return (
    <path className="tr-node-pie" d={`M0 0 L0 ${-r} A${r} ${r} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} />
  );
}
// endregion | Helpers
