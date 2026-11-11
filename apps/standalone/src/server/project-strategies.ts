import {
  createProjectStatusStrategy,
  DEFAULT_PROJECT_STATUS_OPTIONS,
  GitHubAdapterError,
  GitHubNotFoundError,
  GitHubScopeError,
  type GraphqlRequest,
  type ResolvedProject,
  resolveProject,
  type StatusStrategy,
} from '@top-right/adapter-github';

import type { HostConfig } from './config.ts';
import { StartupError } from './startup-error.ts';

const SCOPE_FIX = 'Run `gh auth refresh --scopes project`, or set GITHUB_TOKEN to a token with the "project" scope.';

/**
 * Resolves each project that the config names, once, and returns its status strategy by canonical URL. Throws a
 * `StartupError` that names the fix when a project, its Status field, or a listed option cannot be read.
 */
export async function resolveProjectStrategies(
  request: GraphqlRequest,
  config: Pick<HostConfig, 'projectOf' | 'projectOptions'>,
): Promise<Map<string, StatusStrategy>> {
  const urls = [...new Set(Object.values(config.projectOf))];
  const strategies = await Promise.all(
    urls.map(async (url): Promise<[string, StatusStrategy]> => {
      let project: ResolvedProject;
      try {
        project = await resolveProject(request, url);
      } catch (error) {
        throw new StartupError(describeResolveFailure(url, error), { cause: error });
      }
      const options = config.projectOptions[url];
      try {
        return [url, createProjectStatusStrategy(request, project, options ?? DEFAULT_PROJECT_STATUS_OPTIONS)];
      } catch (error) {
        const hint = options === undefined ? ' List the project\'s options under "projects" in the config file.' : '';
        throw new StartupError(`${describeError(error)}.${hint}`, { cause: error });
      }
    }),
  );
  return new Map(strategies);
}

// region | Helpers
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Returns the startup message for a project that could not be read, with the fix that applies. */
function describeResolveFailure(url: string, error: unknown): string {
  if (error instanceof GitHubScopeError) return `The GitHub token cannot read ${url}. ${SCOPE_FIX}`;
  if (error instanceof GitHubNotFoundError) {
    return `${error.message}. Check the URL in the config file. If the token cannot read the project: ${SCOPE_FIX}`;
  }
  if (error instanceof GitHubAdapterError) return `${error.message}.`;
  return `The GitHub Project ${url} could not be read: ${describeError(error)}`;
}
// endregion | Helpers
