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
}

/** The outline of a hidden done item at the end of a shown edge, which reveals that item when activated. */
export function GhostCircle({ fade, ghost, name, onReveal }: GhostCircleProps): ReactElement {
  const { id, x, y, r } = ghost;

  function revealOnKey(event: KeyboardEvent<SVGGElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onReveal(id);
  }

  return (
    <g
      aria-label={name}
      className="tr-ghost"
      data-fade={fade}
      data-item-key={id}
      onClick={() => onReveal(id)}
      onKeyDown={revealOnKey}
      role="button"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <title>{name}</title>
      <circle className="tr-node-hit" r={Math.max(r, HIT_RADIUS)} />
      <circle className="tr-ghost-border" r={r} />
      <circle className="tr-ghost-focus" r={r + 5.5} />
    </g>
  );
}
