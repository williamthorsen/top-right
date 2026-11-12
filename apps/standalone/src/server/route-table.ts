import type { IncomingMessage, ServerResponse } from 'node:http';

/** Answers one request to a route whose path and method have matched. */
export type Route = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/** Maps each path to the one method that it accepts and the route that answers it. */
export type RouteTable = Record<string, { method: string; handle: Route }>;
