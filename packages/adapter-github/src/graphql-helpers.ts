import { z } from 'zod';

import { GitHubAdapterError, GitHubScopeError, type GraphqlRequest } from './fetch-issues.ts';

/** Names the item that a request concerns, and what the token's scope must cover for it, for error messages. */
export interface RequestSubject {
  /** The item that the request concerns, such as `owner/repo#7` or a project URL. */
  key: string;
  /** What a missing scope prevents, such as "projects". */
  need: string;
}

/** Joins the messages of GraphQL errors into one line. */
export function describeErrors(errors: ReadonlyArray<{ message: string }>): string {
  return errors.map((error) => error.message).join('; ');
}

/**
 * Sends a query or a mutation and returns its parsed data and errors. Rejects, naming the subject's key, on a
 * malformed response, and with a `GitHubScopeError` when the token lacks a scope that the request needs.
 */
export async function sendRequest<T extends z.ZodType>(
  request: GraphqlRequest,
  { key, need }: RequestSubject,
  query: string,
  variables: Record<string, unknown>,
  dataSchema: T,
): Promise<{ data: z.output<T> | undefined; errors: Array<{ message: string; type?: string | undefined }> }> {
  const schema = z.object({
    data: dataSchema.nullish(),
    errors: z.array(z.object({ message: z.string(), type: z.string().optional() })).optional(),
  });
  const parsed = schema.safeParse(await request(query, variables));
  if (!parsed.success) throw new GitHubAdapterError(`${key}: unexpected response from GitHub`, { cause: parsed.error });
  const { data, errors = [] } = parsed.data;
  if (errors.some((error) => error.type === 'INSUFFICIENT_SCOPES')) {
    throw new GitHubScopeError(`${key}: the token lacks the scope that ${need} need`);
  }
  return { data: data ?? undefined, errors };
}

/** Sends a query or a mutation as `sendRequest` does, and also rejects on any error or on a response without data. */
export async function sendStrictRequest<T extends z.ZodType>(
  request: GraphqlRequest,
  subject: RequestSubject,
  query: string,
  variables: Record<string, unknown>,
  dataSchema: T,
): Promise<z.output<T>> {
  const { data, errors } = await sendRequest(request, subject, query, variables, dataSchema);
  if (errors.length > 0) {
    throw new GitHubAdapterError(`${subject.key}: GitHub refused the request: ${describeErrors(errors)}`);
  }
  if (data === undefined) throw new GitHubAdapterError(`${subject.key}: GitHub returned no data`);
  return data;
}
