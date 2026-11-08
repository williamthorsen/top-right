import type { ItemScores, Scorer, Scores, StatusOverride } from '@top-right/model';

/** What the store holds for one user, keyed by item key (`owner/name#number`). */
export interface UserState {
  scores: Record<string, ItemScores>;
  overrides: Record<string, StatusOverride>;
  /** When the user's previous visit ended, as an ISO timestamp. */
  lastVisitAt: string | undefined;
}

/** The storage that a host supplies for scores, status overrides, and visits, each keyed by user. */
export interface Store {
  readUserState(userId: string): Promise<UserState>;
  /** Writes the given fields, stamped with `by` and `at`, and returns the item's resulting scores. */
  writeScores(userId: string, itemKey: string, scores: Scores, by: Scorer, at: string): Promise<ItemScores>;
  /** Sets the override, or clears it when `override` is undefined. */
  writeStatusOverride(userId: string, itemKey: string, override: StatusOverride | undefined): Promise<void>;
  writeLastVisit(userId: string, at: string): Promise<void>;
}
