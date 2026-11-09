import type { ItemScores, Scorer, Scores, StatusOverride, WorkTypeMapping } from '@top-right/model';

/** What the store holds for one user, keyed by item key (`owner/name#number`). */
export interface UserState {
  scores: Record<string, ItemScores>;
  overrides: Record<string, StatusOverride>;
  /** When the user's previous visit ended, as an ISO timestamp. */
  lastVisitAt: string | undefined;
  /** The user's work-type mapping; undefined when the user keeps the default. */
  workTypeMapping: WorkTypeMapping | undefined;
  /** The user's repository abbreviations, keyed by `owner/name`; a repository without one takes its default. */
  abbreviations: Record<string, string>;
}

/** The storage that a host supplies for scores, status overrides, visits, and settings, each keyed by user. */
export interface Store {
  /** Keeps the item's agent scores as the author's, at `at`, and returns the item's resulting scores. */
  keepScores(userId: string, itemKey: string, at: string): Promise<ItemScores>;
  readUserState(userId: string): Promise<UserState>;
  /** Writes `scores` by the rules of `applyScoreWrite` from `@top-right/model`, and returns the item's resulting scores. */
  writeScores(userId: string, itemKey: string, scores: Scores, by: Scorer, at: string): Promise<ItemScores>;
  /** Sets the override, or clears it when `override` is undefined. */
  writeStatusOverride(userId: string, itemKey: string, override: StatusOverride | undefined): Promise<void>;
  /** Replaces the user's repository abbreviations with `abbreviations`. */
  writeAbbreviations(userId: string, abbreviations: Readonly<Record<string, string>>): Promise<void>;
  writeLastVisit(userId: string, at: string): Promise<void>;
  /** Sets the user's work-type mapping, or restores the default when `mapping` is undefined. */
  writeWorkTypeMapping(userId: string, mapping: WorkTypeMapping | undefined): Promise<void>;
}
