import type { ReactElement } from 'react';

import { GRID_SIZE } from './layout.ts';
import type { ItemDrag } from './useItemDrag.ts';

/** The circle that follows the pointer during a drag, at the dragged item's radius. */
export function DragProxy({ drag }: { drag: ItemDrag | undefined }): ReactElement | null {
  if (!drag) return null;
  return <circle aria-hidden="true" className="tr-drag-proxy" cx={drag.x} cy={drag.y} r={drag.r} />;
}

/** The highlight of the scored cell on which a drop would place the dragged item. */
export function DropTarget({ drag, cellSize }: { drag: ItemDrag | undefined; cellSize: number }): ReactElement | null {
  if (!drag?.target) return null;
  return (
    <rect
      aria-hidden="true"
      className="tr-drop-target"
      height={cellSize}
      width={cellSize}
      x={drag.target.u * cellSize}
      y={(GRID_SIZE - 1 - drag.target.v) * cellSize}
    />
  );
}
