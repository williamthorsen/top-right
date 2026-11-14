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
} from '@top-right/model';
import type { Store } from '@top-right/store';
import { describeError } from '@williamthorsen/toolbelt.errors';

import type { ItemsResponse, RepoReadsResponse } from '#src/shared/items-response.ts';
import {
  clearRequestSchema,
  compactScores,
  keepRequestSchema,
  repoReadsRequestSchema,
  scoresRequestSchema,
  statusRequestSchema,
} from '#src/shared/write-requests.ts';

import { resolveFirstLoadRepos } from './first-load-repos.ts';
import { readRequest, sendJson } from './http-json.ts';
import type { ItemsCache, ItemsRead, RepoRead } from './items-cache.ts';
import { clearAuthorScores, type LabelWriter, writeAuthorChange } from './label-write.ts';
import type { RouteTable } from './route-table.ts';
import { describeCollections } from './settings-routes.ts';
import { writeStatusAtSource } from './status-write.ts';

export const CLEAR_SCORES_PATH = '/api/scores/clear';
export const ITEMS_PATH = '/api/items';
export const ITEMS_READ_PATH = '/api/items/read';
export const ITEMS_REFRESH_PATH = '/api/items/refresh';
export const KEEP_PATH = '/api/keep';
export const SCORES_PATH = '/api/scores';
export const STATUS_PATH = '/api/status';
export const VISIT_PATH = '/api/visit';

export interface ItemRoutesOptions {
  items: ItemsCache;
  /** Writes urgency, value, and effort to an issue's labels; without it, the host keeps every score in the store. */
  labelWriter?: LabelWriter | undefined;
  /** The configured repositories (`owner/name`), whose open issues `items` reads with their recently closed ones. */
  repos: readonly string[];
  /** Returns how a repository tracks In progress; without one, the host keeps an item's status as an override. */
  statusStrategyFor?: ((repo: string) => StatusStrategy | undefined) | undefined;
  store: Store;
  /** The user whose scores the routes read and write. */
  userId: string;
  now: () => Date;
}

/** Returns the routes that read the work items and write their scores, status, and the end of a visit. */
export function createItemRoutes({
  items: itemsCache,
  labelWriter,
  repos,
  statusStrategyFor,
  store,
  userId,
  now,
}: ItemRoutesOptions): RouteTable {
  const configuredRepos = new Set(repos);
  const authorWrites = { items: itemsCache, labelWriter, store, userId };
  const statusWrites = { items: itemsCache, store, userId };

  const routes: RouteTable = {
    [CLEAR_SCORES_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, clearRequestSchema);
        if (!body) return;
        const answer = await clearAuthorScores(authorWrites, body.itemKey, body.fields);
        sendJson(response, answer.status, answer.body);
      },
    },
    [ITEMS_PATH]: {
      method: 'GET',
      handle: async (request, response) => {
        const state = await store.readUserState(userId);
        const itemKey = new URL(request.url ?? '/', 'http://localhost').searchParams.get('item') ?? undefined;
        const cached = await readItems(
          () => itemsCache.get(resolveFirstLoadRepos(state.collections, repos, itemKey)),
          response,
        );
        if (!cached) return;
        const { items, reads } = cached;
        const overrides = await dropVoidOverrides(cached, state.overrides);
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
          reads: serializeReads(reads),
        };
        sendJson(response, 200, body);
      },
    },
    [ITEMS_READ_PATH]: {
      method: 'POST',
      handle: (request, response) => answerRepoReads(request, response, itemsCache.get),
    },
    [ITEMS_REFRESH_PATH]: {
      method: 'POST',
      handle: (request, response) => answerRepoReads(request, response, itemsCache.refresh),
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
   * Answers a request for the issues of the repositories that its body names, read by `read`, after deleting the
   * overrides that the read voids; a repository that the config does not list is refused.
   */
  async function answerRepoReads(
    request: IncomingMessage,
    response: ServerResponse,
    read: (repos: readonly string[]) => Promise<ItemsRead>,
  ): Promise<void> {
    const body = await readRequest(request, response, repoReadsRequestSchema);
    if (!body) return;
    const unconfigured = body.repos.find((repo) => !configuredRepos.has(repo));
    if (unconfigured !== undefined) {
      sendJson(response, 400, { error: `${unconfigured} is not a configured repository.` });
      return;
    }
    const result = await readItems(() => read(body.repos), response);
    if (!result) return;
    const state = await store.readUserState(userId);
    // The page keeps its own overrides, so the answer leaves them out.
    await dropVoidOverrides(result, state.overrides);
    const answer: RepoReadsResponse = { items: result.items, reads: serializeReads(result.reads) };
    sendJson(response, 200, answer);
  }

  /**
   * Deletes each stored override whose item's source state has changed, and returns the ones that still apply. An item
   * of a repository in the read that is missing from its items has left the open state at its source, so its override
   * is void too; an override of a repository outside the read is kept.
   */
  async function dropVoidOverrides(
    { items, reads }: ItemsRead,
    overrides: Readonly<Record<string, StatusOverride>>,
  ): Promise<Record<string, StatusOverride>> {
    const itemsByKey = new Map(items.map((item) => [formatItemKey(item), item]));
    const applying: Record<string, StatusOverride> = {};
    for (const [itemKey, override] of Object.entries(overrides)) {
      const item = itemsByKey.get(itemKey);
      const isVoid = item ? isOverrideVoid(item, override) : Object.hasOwn(reads, parseItemKey(itemKey)?.repo ?? '');
      if (isVoid) await store.writeStatusOverride(userId, itemKey, undefined);
      else applying[itemKey] = override;
    }
    return applying;
  }

  return routes;
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

/** Returns each repository's read with its time as an ISO string. */
function serializeReads(reads: Readonly<Record<string, RepoRead>>): ItemsResponse['reads'] {
  return Object.fromEntries(
    Object.entries(reads).map(([repo, { readAt, isStale }]) => [repo, { readAt: readAt.toISOString(), isStale }]),
  );
}
// endregion | Helpers
