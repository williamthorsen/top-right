import {
  classifyWorkType,
  deriveStatus,
  formatItemKey,
  type ItemRef,
  type ItemScores,
  type StatusCategory,
  type StatusOverride,
  type UrgencyLevel,
  type ValueLevel,
  WORK_TYPE_NAMES,
  type WorkItem,
  type WorkType,
  type WorkTypeMapping,
} from '@top-right/model';
import { type Dispatch, type ReactElement, type SetStateAction, useEffect, useRef, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { ExternalLinkIcon } from './ExternalLinkIcon.tsx';
import { StatusSwatch } from './Legend.tsx';
import { LEVEL_NAMES } from './level-names.ts';
import { type ItemSort, type SortColumn, sortItems } from './sort-items.ts';
import { STATUS_NAMES } from './status-names.ts';

export interface ItemTableProps {
  items: readonly WorkItem[];
  scores: Readonly<Record<string, ItemScores>>;
  overrides: Readonly<Record<string, StatusOverride>>;
  workTypeMapping: WorkTypeMapping;
  labelOf: (ref: Pick<ItemRef, 'number' | 'repo'>) => string;
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
  /** Sets the item whose circle the chart rings. */
  onHighlight: Dispatch<SetStateAction<string | undefined>>;
}

const COLUMNS: ReadonlyArray<{ column: SortColumn; name: string; isNumeric?: boolean }> = [
  { column: 'id', name: 'ID' },
  { column: 'title', name: 'Title' },
  { column: 'type', name: 'Type' },
  { column: 'status', name: 'Status' },
  { column: 'urgency', name: 'Urgency' },
  { column: 'value', name: 'Value' },
  { column: 'effort', name: 'Effort', isNumeric: true },
  { column: 'progress', name: 'Progress', isNumeric: true },
];

/** The items as a table that sorts by any column and shares the chart's selection. */
export function ItemTable({
  items,
  scores,
  overrides,
  workTypeMapping,
  labelOf,
  selectedKey,
  onSelect,
  onHighlight,
}: ItemTableProps): ReactElement {
  const [sort, setSort] = useState<ItemSort>();
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const rows =
    sort === undefined
      ? items
      : sortItems(items, sort, {
          scores,
          keyOf: formatItemKey,
          statusOf,
          typeNameOf: (item) => WORK_TYPE_NAMES[typeOf(item)],
        });

  // Bring the selected row into view, whichever view selected it.
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  /** Sorts by the column ascending, or toggles the direction when it is already the sorted column. */
  function sortBy(column: SortColumn): void {
    setSort((current) =>
      current?.column === column
        ? { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { column, direction: 'ascending' },
    );
  }

  function statusOf(item: WorkItem): StatusCategory {
    return deriveStatus(item, overrides[formatItemKey(item)]);
  }

  function typeOf(item: WorkItem): WorkType {
    return classifyWorkType(item.labels, workTypeMapping);
  }

  function clearHighlight(key: string): void {
    onHighlight((current) => (current === key ? undefined : current));
  }

  return (
    <table aria-label="Items" className="tr-table">
      <thead>
        <tr>
          {COLUMNS.map(({ column, name, isNumeric }) => (
            <th
              aria-sort={sort?.column === column ? sort.direction : undefined}
              className={isNumeric ? 'tr-table-number' : undefined}
              key={column}
              scope="col"
            >
              <button className="tr-sort" onClick={() => sortBy(column)} type="button">
                {name}
                <SortIcon direction={sort?.column === column ? sort.direction : undefined} />
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="tr-table-empty" colSpan={COLUMNS.length}>
              No items match the filter.
            </td>
          </tr>
        ) : null}
        {rows.map((item) => {
          const key = formatItemKey(item);
          const isSelected = key === selectedKey;
          const itemScores = scores[key];
          const status = statusOf(item);
          const workType = typeOf(item);
          return (
            <tr
              aria-current={isSelected ? 'true' : undefined}
              className="tr-row"
              data-item-key={key}
              key={key}
              onBlur={() => clearHighlight(key)}
              onClick={() => onSelect(key)}
              onFocus={() => onHighlight(key)}
              onPointerEnter={() => onHighlight(key)}
              onPointerLeave={() => clearHighlight(key)}
              ref={isSelected ? selectedRowRef : undefined}
            >
              <td className="tr-mono">
                <a
                  className="tr-table-id"
                  href={item.url}
                  onClick={(event) => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                >
                  {labelOf(item)}
                  <ExternalLinkIcon />
                  <span className="tr-visually-hidden">(opens in a new tab)</span>
                </a>
              </td>
              <td>
                <button
                  className="tr-row-title"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(key);
                  }}
                  type="button"
                >
                  {item.title}
                </button>
              </td>
              <td data-work-type={workType}>
                <span className="tr-table-tag">
                  <CircleIcon />
                  {WORK_TYPE_NAMES[workType]}
                </span>
              </td>
              <td>
                <span className="tr-table-tag">
                  <StatusSwatch status={status} />
                  {STATUS_NAMES[status]}
                </span>
              </td>
              <td className="tr-table-level">{formatLevel(itemScores?.urgency?.score)}</td>
              <td className="tr-table-level">{formatLevel(itemScores?.value?.score)}</td>
              <td className="tr-table-number">{formatScore(itemScores?.effort?.score)}</td>
              <td className="tr-table-number">
                {itemScores?.progress === undefined ? '–' : `${Math.round(itemScores.progress.score * 100)} %`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// region | Helpers
function formatLevel(level: UrgencyLevel | ValueLevel | undefined): string {
  return level === undefined ? '–' : LEVEL_NAMES[level];
}

function formatScore(value: number | undefined): string {
  return value === undefined ? '–' : String(value);
}

/** The sort arrow: up for ascending, down for descending, and a faint double arrow on an unsorted column. */
function SortIcon({ direction }: { direction: ItemSort['direction'] | undefined }): ReactElement {
  const path =
    direction === 'ascending'
      ? 'M2 7.5 6 3.5l4 4'
      : direction === 'descending'
        ? 'M2 4.5 6 8.5l4-4'
        : 'M3 5 6 2l3 3M3 7l3 3 3-3';
  return (
    <svg
      aria-hidden="true"
      className="tr-sort-icon"
      data-sorted={direction !== undefined}
      fill="none"
      height="12"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 12 12"
      width="12"
    >
      <path d={path} />
    </svg>
  );
}
// endregion | Helpers
