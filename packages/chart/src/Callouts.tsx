import type { WorkItem } from '@top-right/model';
import type { ReactElement } from 'react';

import type { CellCallouts } from './callout-layout.ts';

/** The leader lines that join a cell's callouts to their circles, drawn in the matrix's units. */
export function CalloutLeaders({ callouts }: { callouts: CellCallouts }): ReactElement {
  const { layout } = callouts;
  return (
    <g className="tr-callout-leaders">
      {layout.rows.map((row) => (
        <line key={row.id} x1={row.from.x} x2={layout.x} y1={row.from.y} y2={row.y} />
      ))}
    </g>
  );
}

/**
 * The callout column of a hovered cell: one line per circle with its id label and title, cut to the column's width, and
 * a last line that counts the circles without one. It is a pointer aid that each circle's accessible name duplicates.
 */
export function Callouts({
  callouts,
  itemsByKey,
  labelOf,
  origin,
}: {
  callouts: CellCallouts;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (item: WorkItem) => string;
  /** Where the matrix's origin sits in the layer. */
  origin: { x: number; y: number };
}): ReactElement {
  const { side, x, width, top, rows, overflow } = callouts.layout;
  return (
    <ol
      className="tr-callouts"
      data-side={side}
      style={{ left: origin.x + (side === 'right' ? x : x - width), top: origin.y + top, width }}
    >
      {rows.map((row) => {
        const item = itemsByKey.get(row.id);
        if (!item) return null;
        return (
          <li className="tr-callout" key={row.id}>
            <span className="tr-callout-id">{labelOf(item)}</span>
            {item.title}
          </li>
        );
      })}
      {overflow > 0 ? <li className="tr-callout tr-callout-more">+{overflow} more</li> : null}
    </ol>
  );
}
