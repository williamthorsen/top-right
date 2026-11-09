import { abbreviate, formatIdLabel, type ItemRef } from '@top-right/model';

/** Repository abbreviations keyed by `owner/name`. */
export type Abbreviations = Readonly<Record<string, string>>;

/**
 * Returns the label of an item: `{abbreviation}.{number}` for a repository in `abbreviations`, else the first-letter
 * default, which is ambiguous only for a repository that the host does not configure.
 */
export function labelItem(ref: Pick<ItemRef, 'number' | 'repo'>, abbreviations: Abbreviations): string {
  return formatIdLabel(ref, abbreviations[ref.repo] ?? abbreviate(ref.repo));
}

/** Returns a circle's accessible name: its id label and title, with the marks that it wears. */
export function nameCircle(label: string, title: string, marks: { isBlocked: boolean; isPick: boolean }): string {
  return `${label}: ${title}${marks.isBlocked ? ', blocked' : ''}${marks.isPick ? ', next pick' : ''}`;
}
