import type { IncomingMessage, ServerResponse } from 'node:http';

import { formatItemKey, isOverrideVoid, type StatusOverride, type WorkItem } from '@top-right/model';
import type { Store } from '@top-right/store';
import type { z } from 'zod';

import type { ItemsResponse } from '#src/shared/items-response.ts';
import {
  compactScores,
  keepRequestSchema,
  scoresRequestSchema,
  statusRequestSchema,
} from '#src/shared/write-requests.ts';

export const ITEMS_PATH = '/api/items';
export const KEEP_PATH = '/api/keep';
export const SCORES_PATH = '/api/scores';
export const STATUS_PATH = '/api/status';
export const VISIT_PATH = '/api/visit';

/** The largest request body that the host reads; a scores or status request is far smaller. */
const MAX_BODY_BYTES = 16_384;

export interface ApiOptions {
  loadItems: () => Promise<WorkItem[]>;
  abbreviations: Readonly<Record<string, string>>;
  /** The repositories (`owner/name`) whose open issues `loadItems` returns in full. */
  repos: readonly string[];
  store: Store;
  /** The user whose scores the host reads and writes. */
  userId: string;
  now?: () => Date;
}

/** Returns a handler that answers the host's `/api/` routes and passes every other request to `next`. */
export function createApiHandler({
  loadItems,
  abbreviations,
  repos,
  store,
  userId,
  now = () => new Date(),
}: ApiOptions) {
  const loadedRepos = new Set(repos);

  type Route = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

  const routes: Record<string, { method: string; handle: Route }> = {
    [ITEMS_PATH]: {
      method: 'GET',
      handle: async (_request, response) => {
        let items: WorkItem[];
        try {
          items = await loadItems();
        } catch (error) {
          sendJson(response, 502, { error: describeError(error) });
          return;
        }
        const state = await store.readUserState(userId);
        const overrides = await dropVoidOverrides(items, state.overrides);
        const body: ItemsResponse = {
          items,
          abbreviations: { ...abbreviations },
          scores: state.scores,
          overrides,
          ...(state.lastVisitAt !== undefined && { lastVisitAt: state.lastVisitAt }),
        };
        sendJson(response, 200, body);
      },
    },
    [KEEP_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, keepRequestSchema);
        if (!body) return;
        const scores = await store.keepScores(userId, body.itemKey, now().toISOString());
        sendJson(response, 200, { itemKey: body.itemKey, scores });
      },
    },
    [SCORES_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, scoresRequestSchema);
        if (!body) return;
        const scores = await store.writeScores(
          userId,
          body.itemKey,
          compactScores(body.scores),
          'author',
          now().toISOString(),
        );
        sendJson(response, 200, { itemKey: body.itemKey, scores });
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
        // An open GitHub item is To do at its source, so To do needs no override.
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
      const isVoid = item ? isOverrideVoid(item, override) : loadedRepos.has(readRepo(itemKey));
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
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Returns the `owner/name` part of an item key, `owner/name#number`. */
function readRepo(itemKey: string): string {
  return itemKey.slice(0, itemKey.lastIndexOf('#'));
}

/** Reads and validates a JSON request body, or answers 400 and resolves to `undefined`. */
async function readRequest<T>(
  request: IncomingMessage,
  response: ServerResponse,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'The request body is too large.' });
      return undefined;
    }
    chunks.push(buffer);
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    sendJson(response, 400, { error: 'The request body is not valid JSON.' });
    return undefined;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
    sendJson(response, 400, { error: `Invalid request. ${issues.join('; ')}.` });
    return undefined;
  }
  return parsed.data;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
// endregion | Helpers
