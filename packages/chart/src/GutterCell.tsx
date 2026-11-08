import {
  classifyWorkType,
  isAgentScored,
  type ItemScores,
  type WorkItem,
  type WorkTypeMapping,
} from '@top-right/model';
import type { ReactElement } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { type Abbreviations, labelItem } from './item-label.ts';
import { CELL_SIZE, type CellLayout } from './layout.ts';

export interface GutterCellProps {
  cell: CellLayout;
  scores: Readonly<Record<string, ItemScores>>;
  isFaded: (key: string) => boolean;
  itemsByKey: ReadonlyMap<string, WorkItem>;
  abbreviations: Abbreviations;
  workTypeMapping: WorkTypeMapping;
  selectedKey: string | undefined;
  onPreview: (key: string | undefined) => void;
  onSelect: (key: string) => void;
}

/** A gutter cell's list of items, which scrolls within the cell when it is taller than the cell. */
export function GutterCell({
  cell,
  scores,
  isFaded,
  itemsByKey,
  abbreviations,
  workTypeMapping,
  selectedKey,
  onPreview,
  onSelect,
}: GutterCellProps): ReactElement {
  return (
    <foreignObject height={CELL_SIZE} width={CELL_SIZE} x={cell.x} y={cell.y}>
      <ul aria-label="Unscored items" className="tr-gutter-list" data-overflow={cell.overflow}>
        {cell.ids.map((key) => {
          const item = itemsByKey.get(key);
          if (!item) return null;
          const label = labelItem(item, abbreviations);
          return (
            <li
              data-faded={isFaded(key) && key !== selectedKey}
              data-work-type={classifyWorkType(item.labels, workTypeMapping)}
              key={key}
            >
              <button
                aria-label={`${label}: ${item.title}`}
                aria-pressed={key === selectedKey}
                className="tr-item"
                onBlur={() => onPreview(undefined)}
                onClick={() => onSelect(key)}
                onFocus={() => onPreview(key)}
                onPointerEnter={() => onPreview(key)}
                onPointerLeave={() => onPreview(undefined)}
                type="button"
              >
                <CircleIcon hasHalo={isAgentScored(scores[key])} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </foreignObject>
  );
}
