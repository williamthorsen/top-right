import {
  type Collection,
  EMPTY_REPO_SCOPE,
  type ItemFilter,
  type RepoScope,
  type StatusCategory,
} from '@top-right/model';
import { type ReactElement, useId } from 'react';

import { FilterChip } from './FilterChip.tsx';
import type { Abbreviations } from './item-label.ts';
import { MenuButton, type MenuButtonGroup, type MenuButtonItem } from './MenuButton.tsx';
import { nameRepo, sortRepos } from './repo-names.ts';
import { STATUS_NAMES } from './status-names.ts';

export interface FilterBarProps {
  filter: ItemFilter;
  /** The repositories to offer, keyed by `owner/name` with their abbreviations. */
  abbreviations: Abbreviations;
  /** The collections to offer, in the order in which the user added them. */
  collections?: readonly Collection[] | undefined;
  /** The count of each status within the shown repositories. */
  counts: Readonly<Record<StatusCategory, number>>;
  onChange: (filter: ItemFilter) => void;
}

/** The statuses that the filter offers as chips, in display order. */
const STATUS_CHIPS: readonly StatusCategory[] = ['to-do', 'in-progress', 'done'];

/**
 * The Filter group at the chart's top edge: the Repos menu, whose checkable collections and repositories the chart
 * shows the union of, and one filter chip per status, each with its count.
 */
export function FilterBar({ filter, abbreviations, collections = [], counts, onChange }: FilterBarProps): ReactElement {
  const labelId = useId();
  const repos = sortRepos(Object.keys(abbreviations));
  const { scope } = filter;
  const isEveryRepo = scope.collectionIds.size === 0 && scope.repos.size === 0;
  const scopeLabel = isEveryRepo ? 'All repos' : nameScope(scope, collections);

  function changeScope(next: RepoScope): void {
    onChange({ ...filter, scope: next });
  }

  function toggleStatus(status: StatusCategory): void {
    const statuses = new Set(filter.statuses);
    if (statuses.has(status)) statuses.delete(status);
    else statuses.add(status);
    onChange({ ...filter, statuses });
  }

  const groups: MenuButtonGroup[] = [
    {
      label: 'Collections',
      items: collections.map((collection) =>
        buildToggle(collection.id, collection.name, scope.collectionIds.has(collection.id), () =>
          changeScope({ ...scope, collectionIds: toggle(scope.collectionIds, collection.id) }),
        ),
      ),
    },
    {
      label: 'Repositories',
      items: repos.map((repo) =>
        buildToggle(repo, `${nameRepo(repo)} (${abbreviations[repo] ?? ''})`, scope.repos.has(repo), () =>
          changeScope({ ...scope, repos: toggle(scope.repos, repo) }),
        ),
      ),
    },
  ];

  return (
    <div aria-labelledby={labelId} className="tr-filter" role="group">
      <span className="tr-filter-label" id={labelId}>
        Filter
      </span>
      <MenuButton
        buttonLabel={`Repos: ${scopeLabel}`}
        className="tr-filter-repos"
        closesOnChoose={false}
        items={[
          buildToggle('all', 'All repos', isEveryRepo, () => changeScope(EMPTY_REPO_SCOPE)),
          ...groups.filter((group) => group.items.length > 0),
        ]}
        menuLabel="Repos"
      >
        <span className="tr-filter-repos-label">{scopeLabel}</span>
      </MenuButton>
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
/** Returns a checkable menu item. */
function buildToggle(id: string, label: string, isChecked: boolean, onChoose: () => void): MenuButtonItem {
  return { id, label, role: 'menuitemcheckbox', isChecked, onChoose };
}

/** Returns the names of the scope's collections, then of its repositories, each in menu order, joined by commas. */
function nameScope(scope: RepoScope, collections: readonly Collection[]): string {
  return [
    ...collections.filter((collection) => scope.collectionIds.has(collection.id)).map((collection) => collection.name),
    ...sortRepos([...scope.repos]).map(nameRepo),
  ].join(', ');
}

/** Returns `values` with `value` added, or removed when it is already there. */
function toggle(values: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
// endregion | Helpers
