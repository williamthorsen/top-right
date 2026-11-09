import { z } from 'zod';

import { GitHubAdapterError, type GraphqlRequest } from './fetch-issues.ts';

const VIEWER_QUERY = 'query Viewer { viewer { login } }';

const viewerResponseSchema = z.object({
  data: z.object({ viewer: z.object({ login: z.string().min(1) }) }).nullish(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

/** Reads the login of the user whom the request's token authenticates. */
export async function fetchViewerLogin(request: GraphqlRequest): Promise<string> {
  const parsed = viewerResponseSchema.safeParse(await request(VIEWER_QUERY, {}));
  if (!parsed.success) throw new GitHubAdapterError('viewer: unexpected response from GitHub', { cause: parsed.error });
  const { data, errors } = parsed.data;
  if (errors?.length) throw new GitHubAdapterError(`viewer: ${errors.map((error) => error.message).join('; ')}`);
  if (!data) throw new GitHubAdapterError('viewer: GitHub returned no data');
  return data.viewer.login;
}
