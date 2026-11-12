import type { IncomingMessage, ServerResponse } from 'node:http';

import type { StatusStrategy } from '@top-right/adapter-github';
import type { Store } from '@top-right/store';

import { describeError, sendJson } from './http-json.ts';
import { createItemRoutes } from './item-routes.ts';
import type { ItemsCache } from './items-cache.ts';
import type { LabelWriter } from './label-write.ts';
import type { RouteTable } from './route-table.ts';
import { createSettingsRoutes } from './settings-routes.ts';

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
  items,
  labelWriter,
  repos,
  statusStrategyFor,
  store,
  userId,
  now = () => new Date(),
}: ApiOptions) {
  const routes: RouteTable = {
    ...createSettingsRoutes({ configPath, repos, store, userId }),
    ...createItemRoutes({ items, labelWriter, repos, statusStrategyFor, store, userId, now }),
  };

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
