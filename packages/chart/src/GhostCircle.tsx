import type { StatusCategory, WorkType } from '@top-right/model';
import type { KeyboardEvent, ReactElement } from 'react';

import type { GhostPlacement } from './layout.ts';
import { type Fade, HIT_RADIUS, measureRings, UNSIZED_DOT_COUNT } from './ScoredCircle.tsx';

/** A status whose hidden items take ghosts. */
export type GhostStatus = Extract<StatusCategory, 'backlog' | 'done'>;

export interface GhostCircleProps {
  ghost: GhostPlacement;
  /** The accessible name and the tooltip. */
  name: string;
  /** How strongly a review, the chain view, or a focus fades the ghost; it stays activatable. */
  fade: Fade | undefined;
  onReveal: (id: string) => void;
  status: GhostStatus;
  workType: WorkType;
}

/**
 * A hidden done or backlog item at the end of a shown edge, drawn as a circle of its status, which reveals that item
 * when activated.
 */
export function GhostCircle({ fade, ghost, name, onReveal, status, workType }: GhostCircleProps): ReactElement {
  const { id, x, y, r, isUnsized } = ghost;
  const rings = measureRings(r, false, false);

  function revealOnKey(event: KeyboardEvent<SVGGElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onReveal(id);
  }

  return (
    <g
      aria-label={name}
      className="tr-node"
      data-fade={fade}
      data-item-key={id}
      data-sized={!isUnsized}
      data-status={status}
      data-work-type={workType}
      onClick={() => onReveal(id)}
      onKeyDown={revealOnKey}
      role="button"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <title>{name}</title>
      <circle className="tr-node-hit" r={Math.max(r, HIT_RADIUS)} />
      <circle className="tr-node-main" r={r} />
      <circle className="tr-node-border" pathLength={isUnsized ? UNSIZED_DOT_COUNT : undefined} r={r} />
      <circle className="tr-node-hover" r={rings.hover} />
      <circle className="tr-node-focus" r={rings.focus} />
    </g>
  );
}
