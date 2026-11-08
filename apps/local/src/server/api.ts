import type { IncomingMessage, ServerResponse } from 'node:http';

import type { WorkItem } from '@top-right/model';

import type { ItemsResponse } from '#src/shared/items-response.ts';

export const ITEMS_PATH = '/api/items';

export interface ApiOptions {
  loadItems: () => Promise<WorkItem[]>;
  abbreviations: Readonly<Record<string, string>>;
}

/** Returns a handler that answers `GET /api/items` and passes every other request to `next`. */
export function createApiHandler({ loadItems, abbreviations }: ApiOptions) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void): Promise<void> => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== ITEMS_PATH) {
      next();
      return;
    }
    try {
      const body: ItemsResponse = { items: await loadItems(), abbreviations: { ...abbreviations } };
      sendJson(response, 200, body);
    } catch (error) {
      sendJson(response, 502, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

// region | Helpers
function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
// endregion | Helpers
