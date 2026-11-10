import type { IncomingMessage, ServerResponse } from 'node:http';

import type { z } from 'zod';

/** The largest request body that the host reads; a scores or status request is far smaller. */
const MAX_BODY_BYTES = 16_384;

/** Returns an error's message, or the thrown value as text. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Reads and validates a JSON request body, or answers 400 and resolves to `undefined`. */
export async function readRequest<T>(
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

/** Answers with `body` as JSON, uncached. */
export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
