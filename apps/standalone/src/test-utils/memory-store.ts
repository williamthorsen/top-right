import {
  applyScoreWrite,
  clearScoreFields,
  discardAgentEntries,
  EMPTY_COLLECTION_SETTINGS,
  type ItemScores,
  keepItemScores,
  SCORE_FIELDS,
  type StatusOverride,
} from '@top-right/model';
import type { Store, UserState } from '@top-right/store';

/** A `Store` held in memory, whose first user's state a test reads directly. */
export interface MemoryStore extends Store {
  /** The state of the first user that the store serves. */
  readonly state: UserState;
}

/** Returns an in-memory store in which every user starts from a copy of `initial`. */
export function createMemoryStore(initial: Partial<UserState> = {}): MemoryStore {
  const states = new Map<string, UserState>();
  let primary: UserState | undefined;

  function seed(): UserState {
    return structuredClone({
      scores: {},
      overrides: {},
      lastVisitAt: undefined,
      workTypeMapping: undefined,
      scoreLabelMapping: undefined,
      abbreviations: {},
      collections: EMPTY_COLLECTION_SETTINGS,
      ...initial,
    });
  }

  function readPrimary(): UserState {
    primary ??= seed();
    return primary;
  }

  /** Returns the user's state, giving the first user the state that `state` exposes. */
  function stateOf(userId: string): UserState {
    let state = states.get(userId);
    if (!state) {
      state = states.size === 0 ? readPrimary() : seed();
      states.set(userId, state);
    }
    return state;
  }

  return {
    get state() {
      return readPrimary();
    },
    readUserState: (userId) => Promise.resolve(structuredClone(stateOf(userId))),
    clearScores: (userId, itemKey, fields) => {
      const state = stateOf(userId);
      const itemScores = clearScoreFields(state.scores[itemKey], fields);
      if (Object.keys(itemScores).length > 0) state.scores[itemKey] = itemScores;
      else state.scores = Object.fromEntries(Object.entries(state.scores).filter(([key]) => key !== itemKey));
      return Promise.resolve(structuredClone(itemScores));
    },
    discardAgentScores: (userId, stamp, restoreFields, at) => {
      const state = stateOf(userId);
      const changed: Record<string, ItemScores> = {};
      for (const [itemKey, existing] of Object.entries(state.scores)) {
        if (SCORE_FIELDS.every((field) => existing[field]?.by !== 'agent' || existing[field].at !== stamp)) continue;
        const itemScores = discardAgentEntries(existing, stamp, restoreFields, at);
        if (Object.keys(itemScores).length > 0) state.scores[itemKey] = itemScores;
        else state.scores = Object.fromEntries(Object.entries(state.scores).filter(([key]) => key !== itemKey));
        changed[itemKey] = itemScores;
      }
      return Promise.resolve(structuredClone(changed));
    },
    keepScores: (userId, itemKey, at) => {
      const state = stateOf(userId);
      const itemScores = keepItemScores(state.scores[itemKey], at);
      if (Object.keys(itemScores).length > 0) state.scores[itemKey] = itemScores;
      return Promise.resolve(structuredClone(itemScores));
    },
    writeScores: (userId, itemKey, values, by, at, reason) => {
      const state = stateOf(userId);
      const itemScores = applyScoreWrite(state.scores[itemKey], values, by, at, reason);
      state.scores[itemKey] = itemScores;
      return Promise.resolve(structuredClone(itemScores));
    },
    writeScoreLabelMapping: (userId, mapping) => {
      stateOf(userId).scoreLabelMapping = mapping === undefined ? undefined : structuredClone(mapping);
      return Promise.resolve();
    },
    writeStatusOverride: (userId, itemKey, override: StatusOverride | undefined) => {
      const state = stateOf(userId);
      if (override) state.overrides[itemKey] = override;
      else state.overrides = Object.fromEntries(Object.entries(state.overrides).filter(([key]) => key !== itemKey));
      return Promise.resolve();
    },
    writeAbbreviations: (userId, abbreviations) => {
      stateOf(userId).abbreviations = { ...abbreviations };
      return Promise.resolve();
    },
    writeCollections: (userId, settings) => {
      stateOf(userId).collections = structuredClone(settings);
      return Promise.resolve();
    },
    writeLastVisit: (userId, at) => {
      stateOf(userId).lastVisitAt = at;
      return Promise.resolve();
    },
    writeWorkTypeMapping: (userId, mapping) => {
      stateOf(userId).workTypeMapping = mapping === undefined ? undefined : structuredClone(mapping);
      return Promise.resolve();
    },
  };
}
