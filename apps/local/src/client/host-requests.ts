import type { z } from 'zod';

import { errorResponseSchema } from '#src/shared/items-response.ts';

/** Returns the reason for a failed request as a phrase: the host's message, or what the client observed. */
export function describeError(error: unknown): string {
  if (error instanceof TypeError) return 'the host did not respond';
  return error instanceof Error ? error.message : String(error);
}

/** Reads a JSON body from the host, throwing the host's error message on a failed response. */
export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path);
  const body = await readJsonBody(response);
  if (!response.ok) throw new Error(readErrorMessage(body, response.status));
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
  if (!response.ok) throw new Error(readErrorMessage(body, response.status));
  return schema.parse(body);
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
