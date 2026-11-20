import type { WorkItem } from '@top-right/model';
import type { ReactElement } from 'react';

import { CALLOUT_PITCH } from './callout-layout.ts';
import type { TitleLaneLayout } from './title-lane.ts';

/** The titles lane with what decides its leaders and its rows' responses. */
export interface TitleLaneView {
  layout: TitleLaneLayout;
  /** Whether every row has its leader; otherwise only the selected and hovered items' rows do. */
  showsAllLeaders: boolean;
  selectedKey: string | undefined;
  /** The item of the hovered row or circle. */
  hoveredKey: string | undefined;
  onHighlight: (key: string | undefined) => void;
  onSelect: (key: string) => void;
  /** Reports whether the pointer is over the lane, which holds the cell to which the lane narrows. */
  onPointerOverChange: (isOver: boolean) => void;
}

/**
 * The titles lane: section headings, one line per item with its id label and title, cut to the lane's width, and each
 * section's count of the items without a line. Hovering a line highlights its item and clicking it selects the item;
 * like the callouts, it is a pointer aid that each item's accessible name and the table duplicate.
 */
export function TitleLane({
  view,
  itemsByKey,
  labelOf,
  origin,
}: {
  view: TitleLaneView;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  labelOf: (item: WorkItem) => string;
  /** Where the matrix's origin sits in the layer. */
  origin: { x: number; y: number };
}): ReactElement {
  const { layout, selectedKey, hoveredKey, onHighlight, onSelect, onPointerOverChange } = view;
  return (
    <ol
      className="tr-title-lane"
      onPointerEnter={() => onPointerOverChange(true)}
      onPointerLeave={() => onPointerOverChange(false)}
      style={{ left: origin.x + layout.x, top: origin.y, width: layout.width, height: layout.height }}
    >
      {layout.rows.map((row) => {
        const style = { top: row.y - CALLOUT_PITCH / 2 };
        if (row.kind === 'heading') {
          return (
            <li className="tr-title-heading" key={row.key} style={style}>
              {row.label}
            </li>
          );
        }
        if (row.kind === 'more') {
          return (
            <li className="tr-title-more" key={row.key} style={style}>
              +{row.count} more
            </li>
          );
        }
        const item = itemsByKey.get(row.id);
        if (!item) return null;
        return (
          <li key={row.id} style={style}>
            {/* Out of the tab order, because the lane is a pointer aid; the circles and the table take the keys. */}
            <button
              className="tr-title"
              data-hovered={row.id === hoveredKey}
              data-selected={row.id === selectedKey}
              onClick={() => onSelect(row.id)}
              onPointerEnter={() => onHighlight(row.id)}
              onPointerLeave={() => onHighlight(undefined)}
              tabIndex={-1}
              type="button"
            >
              <span className="tr-title-id">{labelOf(item)}</span>
              {item.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The leaders that join the lane's rows to their circles, drawn in the matrix's units. */
export function TitleLeaders({ view }: { view: TitleLaneView }): ReactElement {
  const { layout, showsAllLeaders, selectedKey, hoveredKey } = view;
  return (
    <g className="tr-title-leaders">
      {layout.rows.map((row) => {
        if (row.kind !== 'item') return null;
        const isHovered = row.id === hoveredKey;
        const isSelected = row.id === selectedKey;
        if (!showsAllLeaders && !isHovered && !isSelected) return null;
        const state = isHovered ? 'hovered' : isSelected ? 'selected' : undefined;
        return <line data-state={state} key={row.id} x1={row.from.x} x2={layout.x} y1={row.from.y} y2={row.y} />;
      })}
    </g>
  );
}
