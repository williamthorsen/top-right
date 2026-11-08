import { applyScoreWrite, keepItemScores, type StatusOverride } from '@top-right/model';
import type { Store, UserState } from '@top-right/store';

/** A `Store` held in memory for one user, whose state a test reads directly. */
export interface MemoryStore extends Store {
  state: UserState;
}

/** Returns an in-memory store that serves `initial` to every user id. */
export function createMemoryStore(initial: Partial<UserState> = {}): MemoryStore {
  const state: UserState = { scores: {}, overrides: {}, lastVisitAt: undefined, ...initial };
  return {
    state,
    readUserState: () => Promise.resolve(structuredClone(state)),
    keepScores: (_userId, itemKey, at) => {
      const itemScores = keepItemScores(state.scores[itemKey], at);
      if (Object.keys(itemScores).length > 0) state.scores[itemKey] = itemScores;
      return Promise.resolve(structuredClone(itemScores));
    },
    writeScores: (_userId, itemKey, values, by, at) => {
      const itemScores = applyScoreWrite(state.scores[itemKey], values, by, at);
      state.scores[itemKey] = itemScores;
      return Promise.resolve(structuredClone(itemScores));
    },
    writeStatusOverride: (_userId, itemKey, override: StatusOverride | undefined) => {
      if (override) state.overrides[itemKey] = override;
      else state.overrides = Object.fromEntries(Object.entries(state.overrides).filter(([key]) => key !== itemKey));
      return Promise.resolve();
    },
    writeLastVisit: (_userId, at) => {
      state.lastVisitAt = at;
      return Promise.resolve();
    },
  };
}
