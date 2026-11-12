import type { IncomingMessage, ServerResponse } from 'node:http';

import type { StatusStrategy } from '@top-right/adapter-github';
import {
  applyScoreWrite,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  findAbbreviationClashes,
  formatItemKey,
  isOverrideVoid,
  keepItemScores,
  parseItemKey,
  resolveAbbreviations,
  type StatusOverride,
  type WorkItem,
} from '@top-right/model';
import type { Store } from '@top-right/store';

import type { ItemsResponse, RefreshResponse } from '#src/shared/items-response.ts';
import {
  compactScores,
  keepRequestSchema,
  scoresRequestSchema,
  statusRequestSchema,
} from '#src/shared/write-requests.ts';

import { describeError, readRequest, sendJson } from './http-json.ts';
import type { ItemsCache } from './items-cache.ts';
import { type LabelWriter, writeAuthorChange } from './label-write.ts';
import type { RouteTable } from './route-table.ts';
import { createSettingsRoutes, describeCollections } from './settings-routes.ts';
import { writeStatusAtSource } from './status-write.ts';

export const ITEMS_PATH = '/api/items';
export const ITEMS_REFRESH_PATH = '/api/items/refresh';
export const KEEP_PATH = '/api/keep';
export const SCORES_PATH = '/api/scores';
export const STATUS_PATH = '/api/status';
export const VISIT_PATH = '/api/visit';

export interface ApiOptions {
  /** The absolute path of the config file that lists `repos`. */
  configPath: string;
  items: ItemsCache;
  /** Writes urgency, value, and effort to an issue's labels; without it, the host keeps every score in the store. */
  labelWriter?: LabelWriter | undefined;
  /** The repositories (`owner/name`) whose open issues `items` holds in full, with their recently closed ones. */
  repos: readonly string[];
  /** Returns how a repository tracks In progress; without one, the host keeps an item's status as an override. */
  statusStrategyFor?: ((repo: string) => StatusStrategy | undefined) | undefined;
  store: Store;
  /** The user whose scores the host reads and writes. */
  userId: string;
  now?: () => Date;
}

/** Returns a handler that answers the host's `/api/` routes and passes every other request to `next`. */
export function createApiHandler({
  configPath,
  items: itemsCache,
  labelWriter,
  repos,
  statusStrategyFor,
  store,
  userId,
  now = () => new Date(),
}: ApiOptions) {
  const configuredRepos = new Set(repos);
  const authorWrites = { items: itemsCache, labelWriter, store, userId };
  const statusWrites = { items: itemsCache, store, userId };

  const routes: RouteTable = {
    ...createSettingsRoutes({ configPath, repos, store, userId }),
    [ITEMS_PATH]: {
      method: 'GET',
      handle: async (_request, response) => {
        const cached = await readItems(itemsCache.get, response);
        if (!cached) return;
        const { items, readAt, isStale } = cached;
        const state = await store.readUserState(userId);
        const overrides = await dropVoidOverrides(items, state.overrides);
        const abbreviations = resolveAbbreviations(repos, state.abbreviations);
        const body: ItemsResponse = {
          items,
          abbreviations,
          abbreviationClashes: findAbbreviationClashes(abbreviations),
          ...describeCollections(state.collections, configuredRepos),
          workTypeMapping: state.workTypeMapping ?? DEFAULT_WORK_TYPE_MAPPING,
          scoreLabelMapping: state.scoreLabelMapping ?? DEFAULT_SCORE_LABEL_MAPPING,
          scores: state.scores,
          overrides,
          ...(state.lastVisitAt !== undefined && { lastVisitAt: state.lastVisitAt }),
          readAt: readAt.toISOString(),
          isStale,
        };
        sendJson(response, 200, body);
      },
    },
    [ITEMS_REFRESH_PATH]: {
      method: 'POST',
      handle: async (_request, response) => {
        const read = await readItems(itemsCache.refresh, response);
        if (!read) return;
        const state = await store.readUserState(userId);
        await dropVoidOverrides(read.items, state.overrides);
        const body: RefreshResponse = { items: read.items, readAt: read.readAt.toISOString() };
        sendJson(response, 200, body);
      },
    },
    [KEEP_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, keepRequestSchema);
        if (!body) return;
        const at = now().toISOString();
        const answer = await writeAuthorChange(authorWrites, body.itemKey, {
          apply: (stored) => keepItemScores(stored, at),
          write: () => store.keepScores(userId, body.itemKey, at),
        });
        sendJson(response, answer.status, answer.body);
      },
    },
    [SCORES_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, scoresRequestSchema);
        if (!body) return;
        const changed = compactScores(body.scores);
        const at = now().toISOString();
        const answer = await writeAuthorChange(authorWrites, body.itemKey, {
          apply: (stored) => applyScoreWrite(stored, changed, 'author', at),
          write: () => store.writeScores(userId, body.itemKey, changed, 'author', at),
        });
        sendJson(response, answer.status, answer.body);
      },
    },
    [STATUS_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, statusRequestSchema);
        if (!body) return;
        if (body.sourceState === 'closed') {
          sendJson(response, 400, { error: 'The item is closed at its source; Done is read from the source.' });
          return;
        }
        const ref = parseItemKey(body.itemKey);
        const strategy = ref && statusStrategyFor?.(ref.repo);
        if (ref && strategy) {
          const answer = await writeStatusAtSource(statusWrites, strategy, ref, body.itemKey, body.status);
          sendJson(response, answer.status, answer.body);
          return;
        }
        // Without a strategy, an open item is To do at its source, so To do needs no override.
        const override: StatusOverride | undefined =
          body.status === 'to-do'
            ? undefined
            : { status: body.status, sourceState: body.sourceState, at: now().toISOString() };
        await store.writeStatusOverride(userId, body.itemKey, override);
        sendJson(response, 200, { itemKey: body.itemKey, override: override ?? null });
      },
    },
    [VISIT_PATH]: {
      method: 'POST',
      handle: async (_request, response) => {
        try {
          await store.writeLastVisit(userId, now().toISOString());
        } catch (error) {
          // `sendBeacon` discards the response, so the log is the only report of the failure.
          console.error(`top-right: the end of the visit was not recorded: ${describeError(error)}`);
        }
        response.writeHead(204).end();
      },
    },
  };

  /**
   * Deletes each stored override whose item's source state has changed, and returns the ones that still apply. An item
   * of a loaded repository that is missing from the open items has left the open state at its source, so its override
   * is void too; an override of a repository that the host no longer loads is kept.
   */
  async function dropVoidOverrides(
    items: readonly WorkItem[],
    overrides: Readonly<Record<string, StatusOverride>>,
  ): Promise<Record<string, StatusOverride>> {
    const itemsByKey = new Map(items.map((item) => [formatItemKey(item), item]));
    const applying: Record<string, StatusOverride> = {};
    for (const [itemKey, override] of Object.entries(overrides)) {
      const item = itemsByKey.get(itemKey);
      const isVoid = item ? isOverrideVoid(item, override) : configuredRepos.has(parseItemKey(itemKey)?.repo ?? '');
      if (isVoid) await store.writeStatusOverride(userId, itemKey, undefined);
      else applying[itemKey] = override;
    }
    return applying;
  }

  return async (request: IncomingMessage, response: ServerResponse, next: () => void): Promise<void> => {
    const route = routes[new URL(request.url ?? '/', 'http://localhost').pathname];
    if (!route) {
      next();
      return;
    }
    if (request.method !== route.method) {
      response.setHeader('allow', route.method);
      sendJson(response, 405, { error: `Use ${route.method} for this path.` });
      return;
    }
    try {
      await route.handle(request, response);
    } catch (error) {
      sendJson(response, 500, { error: describeError(error) });
    }
  };
}

// region | Helpers
/** Returns the result of a read of the issues, or answers 502 and resolves to `undefined`. */
async function readItems<T>(read: () => Promise<T>, response: ServerResponse): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    sendJson(response, 502, { error: describeError(error) });
    return undefined;
  }
}

// endregion | Helpers
