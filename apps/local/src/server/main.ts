import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { fetchOpenIssuesOfRepos, fetchViewerLogin, type GraphqlRequest } from '@top-right/adapter-github';
import { createServer as createViteServer } from 'vite';

import { createApiHandler } from './api.ts';
import { readConfig, resolveAbbreviations } from './config.ts';
import { resolveDatabasePath } from './database-path.ts';
import { createGithubRequest } from './github-request.ts';
import { openSqliteStore, type SqliteStore } from './sqlite-store.ts';
import { StartupError } from './startup-error.ts';
import { resolveToken } from './token.ts';

const CONFIG_PATH = fileURLToPath(new URL('../../config.local.json', import.meta.url));
const VITE_CONFIG_PATH = fileURLToPath(new URL('../../vite.config.ts', import.meta.url));
const DEFAULT_PORT = 4310;

try {
  await startHost();
} catch (error) {
  if (!(error instanceof StartupError)) throw error;
  console.error(`top-right: ${error.message}`);
  process.exitCode = 1;
}

/** Starts the local host: the items endpoint in front of Vite, which serves the page. */
async function startHost(): Promise<void> {
  const config = await readConfig(CONFIG_PATH);
  const abbreviations = resolveAbbreviations(config);
  const token = await resolveToken(process.env, runCommand);
  const request = createGithubRequest(token);
  const repos = config.repos.map((entry) => entry.repo);
  const userId = await resolveUserId(request);
  const databasePath = resolveDatabasePath(process.env, os.homedir());
  const store = openStore(databasePath);

  const vite = await createViteServer({ configFile: VITE_CONFIG_PATH, server: { middlewareMode: true } });
  const handleApi = createApiHandler({
    loadItems: () => fetchOpenIssuesOfRepos(request, repos),
    abbreviations,
    store,
    userId,
  });
  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);

  createServer((req, res) => void handleApi(req, res, () => vite.middlewares(req, res))).listen(
    port,
    'localhost',
    () => {
      console.info(
        `top-right: serving ${repos.length} repositories at http://localhost:${port}/, with scores in ${databasePath}`,
      );
    },
  );
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
