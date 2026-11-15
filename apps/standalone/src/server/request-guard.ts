import type { IncomingMessage } from 'node:http';

/** The names under which the page reaches the host; any other name is a page that rebinds its own domain. */
const LOOPBACK_NAMES = ['localhost', '127.0.0.1', '[::1]'];

/** The `Sec-Fetch-Site` values of a request that the host's own page or the author's address bar sent. */
const OWN_FETCH_SITES = new Set(['none', 'same-origin']);

/**
 * Returns why the host refuses `request`, or `undefined` when the request comes from the host's own page or from a
 * client outside the browser. A foreign `Host` is refused on every method; a write is also refused from another site
 * or with a body that is not JSON, which a page on another site can send without a preflight.
 */
export function findRefusal(request: IncomingMessage): string | undefined {
  const host = request.headers.host?.toLowerCase();
  const port = request.socket.localPort;
  if (host === undefined || LOOPBACK_NAMES.every((name) => host !== `${name}:${port}`)) {
    return `The host answers only at localhost:${port}.`;
  }
  if (request.method === 'GET') return undefined;

  const origin = request.headers.origin;
  const fetchSite = request.headers['sec-fetch-site'];
  if (
    (origin !== undefined && origin.toLowerCase() !== `http://${host}`) ||
    (fetchSite !== undefined && !OWN_FETCH_SITES.has(fetchSite))
  ) {
    return 'The request came from another site.';
  }
  if (hasBody(request) && readMediaType(request) !== 'application/json') {
    return 'The request body must be sent as application/json.';
  }
  return undefined;
}

// region | Helpers
/** Reports whether `request` declares a body, by either of the two headers through which HTTP/1.1 declares one. */
function hasBody(request: IncomingMessage): boolean {
  return Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined;
}

/** Returns the request's media type without its parameters, lowercased. */
function readMediaType(request: IncomingMessage): string | undefined {
  return request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
}
// endregion | Helpers
