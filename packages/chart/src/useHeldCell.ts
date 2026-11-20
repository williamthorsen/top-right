import { useEffect, useState } from 'react';

import type { HoveredCell } from './useCellHover.ts';

/** How long, in milliseconds, a narrowed lane outlasts its cell's hover, so that the pointer can cross cells to it. */
export const NARROW_HOLD = 400;

/**
 * Returns the cell to which the titles lane narrows: a newly hovered cell at once, and the last one for `NARROW_HOLD`
 * after its hover ends, or for as long as `isHolding`, which the pointer's resting on the lane sets.
 */
export function useHeldCell(cell: HoveredCell | undefined, isHolding: boolean): HoveredCell | undefined {
  const [held, setHeld] = useState(cell);
  if (cell && (cell.u !== held?.u || cell.v !== held.v)) setHeld(cell);

  useEffect(() => {
    if (cell || isHolding) return;
    const timer = setTimeout(() => setHeld(undefined), NARROW_HOLD);
    return () => clearTimeout(timer);
  }, [cell, isHolding]);

  return held;
}
