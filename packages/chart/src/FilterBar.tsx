import type { ItemFilter, StatusCategory } from '@top-right/model';
import { type ReactElement, useId } from 'react';

import { FilterChip } from './FilterChip.tsx';
import type { Abbreviations } from './item-label.ts';
import { STATUS_NAMES } from './status-names.ts';

export interface FilterBarProps {
  filter: ItemFilter;
  /** The repositories to offer, keyed by `owner/name` with their abbreviations. */
  abbreviations: Abbreviations;
  /** The count of each status within the repo filter. */
  counts: Readonly<Record<StatusCategory, number>>;
  onChange: (filter: ItemFilter) => void;
}

/** The statuses that the filter offers as chips, in display order. */
const STATUS_CHIPS: readonly StatusCategory[] = ['to-do', 'in-progress', 'done'];

/** The Filter group at the chart's top edge: a repo select and one filter chip per status, each with its count. */
export function FilterBar({ filter, abbreviations, counts, onChange }: FilterBarProps): ReactElement {
  const labelId = useId();
  const repos = Object.keys(abbreviations).toSorted(
    (a, b) => nameRepo(a).localeCompare(nameRepo(b)) || a.localeCompare(b),
  );

  function toggleStatus(status: StatusCategory): void {
    const statuses = new Set(filter.statuses);
    if (statuses.has(status)) statuses.delete(status);
    else statuses.add(status);
    onChange({ ...filter, statuses });
  }

  return (
    <div aria-labelledby={labelId} className="tr-filter" role="group">
      <span className="tr-filter-label" id={labelId}>
        Filter
      </span>
      <select
        aria-label="Repo"
        className="tr-select"
        onChange={(event) => onChange({ ...filter, repo: event.target.value === '' ? undefined : event.target.value })}
        value={filter.repo ?? ''}
      >
        <option value="">All repos</option>
        {repos.map((repo) => (
          <option key={repo} value={repo}>
            {nameRepo(repo)} ({abbreviations[repo]})
          </option>
        ))}
      </select>
      <div aria-label="Status" className="tr-filter-statuses" role="group">
        {STATUS_CHIPS.map((status) => (
          <FilterChip isPressed={filter.statuses.has(status)} key={status} onToggle={() => toggleStatus(status)}>
            {STATUS_NAMES[status]} <span className="tr-filter-count">{counts[status]}</span>
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

// region | Helpers
/** Returns the repository's name without its owner. */
function nameRepo(repo: string): string {
  return repo.slice(repo.indexOf('/') + 1);
}
// endregion | Helpers
