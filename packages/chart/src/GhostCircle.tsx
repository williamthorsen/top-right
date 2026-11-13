import type { WorkType } from '@top-right/model';
import type { KeyboardEvent, ReactElement } from 'react';

import type { GhostPlacement } from './layout.ts';
import { type Fade, HIT_RADIUS } from './ScoredCircle.tsx';

export interface GhostCircleProps {
  ghost: GhostPlacement;
  /** The accessible name and the tooltip. */
  name: string;
  /** How strongly a review, the chain view, or a focus fades the ghost; it stays activatable. */
  fade: Fade | undefined;
  onReveal: (id: string) => void;
  workType: WorkType;
}

/** A hidden done item at the end of a shown edge, drawn as a done circle, which reveals that item when activated. */
export function GhostCircle({ fade, ghost, name, onReveal, workType }: GhostCircleProps): ReactElement {
  const { id, x, y, r, isUnsized } = ghost;

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
      data-status="done"
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
      <circle className="tr-node-border" r={r} />
      {isUnsized ? <circle className="tr-node-floor" r={Math.max(2, r - 3.5)} /> : null}
      <circle className="tr-node-selected" r={r + 3} />
      <circle className="tr-node-focus" r={r + 5.5} />
    </g>
  );
}
