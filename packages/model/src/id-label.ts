import type { ItemRef } from './work-item.ts';

/** Returns the default abbreviation of an `owner/name` repository: the first letter of its name, lowercased. */
export function abbreviate(repo: string): string {
  const name = repo.slice(repo.indexOf('/') + 1);
  return name.charAt(0).toLowerCase();
}

/** Returns the label that a circle shows for an item, as `{abbreviation}.{number}`. */
export function formatIdLabel(ref: Pick<ItemRef, 'number'>, abbreviation: string): string {
  return `${abbreviation}.${ref.number}`;
}
