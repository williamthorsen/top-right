import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  createLabelStatusStrategy,
  fetchIssues,
  fetchIssuesOfRepos,
  fetchViewerLogin,
  type GraphqlRequest,
  type StatusStrategy,
  updateIssueLabels,
} from '@top-right/adapter-github';
import type { WorkItem } from '@top-right/model';

import { computeClosedSince, formatAbbreviationNotice, readConfig } from './config.ts';
import { resolveDatabasePath } from './database-path.ts';
import { createGithubRequest } from './github-request.ts';
import type { LabelWriter } from './label-write.ts';
import { resolveProjectStrategies } from './project-strategies.ts';
import { openSqliteStore, type SqliteStore } from './sqlite-store.ts';
import { StartupError } from './startup-error.ts';
import { resolveToken } from './token.ts';
import { describeScopeWarnings, fetchTokenScopes } from './token-scopes.ts';

/** What the host and the CLI read and write: the configured repositories, the user, and the user's store. */
export interface HostContext {
  /** The absolute path of the config file that the host read. */
  configPath: string;
  databasePath: string;
  /** Writes an issue's labels through the GitHub adapter. */
  labelWriter: LabelWriter;
  /**
   * Reads the open issues of the configured repositories and those closed within the configured window, with each open
   * issue's source status.
   */
  loadItems: () => Promise<WorkItem[]>;
  /** Reads one configured repository's issues as `loadItems` reads each repository's. */
  loadRepo: (repo: string) => Promise<WorkItem[]>;
  /** The configured repositories, as `owner/name`. */
  repos: string[];
  /**
   * Returns how a repository tracks In progress: through the GitHub Project that its config entry names, else through
   * the label; `undefined` for a repository that the host does not read.
   */
  statusStrategyFor: (repo: string) => StatusStrategy | undefined;
  store: SqliteStore;
  /** The user whose scores are read and written, as `github:<login>`. */
  userId: string;
}

const CONFIG_PATH = fileURLToPath(new URL('../../config.local.json', import.meta.url));

/**
 * Reads the config, resolves the GitHub token and user, resolves each configured project, warns about scopes that the
 * token's writes lack, and opens the store; throws a `StartupError` on a problem.
 */
export async function openHostContext(): Promise<HostContext> {
  const config = await readConfig(CONFIG_PATH);
  const notice = formatAbbreviationNotice(config);
  if (notice !== undefined) console.warn(`top-right: ${notice}`);
  const token = await resolveToken(process.env, runCommand);
  const request = createGithubRequest(token);
  const { repos } = config;
  const userId = await resolveUserId(request);
  const projectStrategies = await resolveProjectStrategies(request, config);
  const scopeWarnings = describeScopeWarnings(await fetchTokenScopes(token), {
    hasLabelRepos: repos.some((repo) => config.projectOf[repo] === undefined),
    hasProjectRepos: repos.some((repo) => config.projectOf[repo] !== undefined),
  });
  for (const warning of scopeWarnings) console.warn(`top-right: ${warning}`);
  const databasePath = resolveDatabasePath(process.env, os.homedir());
  const store = openStore(databasePath);
  const labelStrategy = createLabelStatusStrategy(request);
  function statusStrategyFor(repo: string): StatusStrategy | undefined {
    if (!repos.includes(repo)) return undefined;
    const projectUrl = config.projectOf[repo];
    return projectUrl === undefined ? labelStrategy : projectStrategies.get(projectUrl);
  }
  return {
    configPath: CONFIG_PATH,
    databasePath,
    labelWriter: (ref, change) => updateIssueLabels(request, ref.repo, ref.number, change),
    loadItems: () =>
      fetchIssuesOfRepos(request, repos, {
        closedSince: computeClosedSince(new Date(), config.closedWindowDays),
        strategyFor: statusStrategyFor,
      }),
    loadRepo: (repo) =>
      fetchIssues(request, repo, {
        closedSince: computeClosedSince(new Date(), config.closedWindowDays),
        status: statusStrategyFor(repo),
      }),
    repos,
    statusStrategyFor,
    store,
    userId,
  };
}

// region | Helpers
function openStore(databasePath: string): SqliteStore {
  try {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    return openSqliteStore(databasePath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new StartupError(
      `The score store did not open at ${databasePath}: ${reason}. Set TOP_RIGHT_DB to another path.`,
    );
  }
}

/** Returns the id under which the token's user keeps scores, as `github:<login>`. */
async function resolveUserId(request: GraphqlRequest): Promise<string> {
  try {
    return `github:${await fetchViewerLogin(request)}`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new StartupError(`The GitHub user could not be read: ${reason}`);
  }
}

async function runCommand(command: string, args: readonly string[]): Promise<string> {
  const { stdout } = await promisify(execFile)(command, [...args]);
  return stdout;
}
// endregion | Helpers
