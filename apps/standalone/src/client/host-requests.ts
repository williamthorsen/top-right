import { describeError } from '@williamthorsen/toolbelt.errors';
import type { z } from 'zod';

import { errorResponseSchema } from '#src/shared/items-response.ts';

/** A failed response from the host, with its JSON body for a caller that reads more than the message. */
export class HostResponseError extends Error {
  readonly body: unknown;

  constructor(message: string, body: unknown) {
    super(message);
    this.name = 'HostResponseError';
    this.body = body;
  }
}

/** Returns the reason for a failed request as a phrase: the host's message, or what the client observed. */
export function describeRequestError(error: unknown): string {
  if (error instanceof TypeError) return 'the host did not respond';
  return describeError(error);
}

/** Reads a JSON body from the host, throwing the host's error message on a failed response. */
export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path);
  const body = await readJsonBody(response);
  if (!response.ok) throw new HostResponseError(readErrorMessage(body, response.status), body);
  return schema.parse(body);
}

/** Posts `payload` as JSON and reads the host's JSON answer, throwing the host's error message on a failed response. */
export async function postJson<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await readJsonBody(response);
  if (!response.ok) throw new HostResponseError(readErrorMessage(body, response.status), body);
  return schema.parse(body);
}

/**
 * Posts `payload` as JSON and calls `onLine` with each line of the host's NDJSON answer, parsed by `schema`, until the
 * stream ends; throws the host's error message on a failed response.
 */
export async function postStream<T>(
  path: string,
  payload: unknown,
  schema: z.ZodType<T>,
  onLine: (line: T) => void,
): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok || response.body === null) {
    const body = await readJsonBody(response);
    throw new HostResponseError(readErrorMessage(body, response.status), body);
  }
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) if (line.trim() !== '') onLine(schema.parse(JSON.parse(line)));
  }
  if (pending.trim() !== '') onLine(schema.parse(JSON.parse(pending)));
}

// region | Helpers
/** Returns the response's JSON body, or `undefined` when the body is not JSON. */
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

function readErrorMessage(body: unknown, status: number): string {
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : `the host responded ${status}`;
}
// endregion | Helpers
