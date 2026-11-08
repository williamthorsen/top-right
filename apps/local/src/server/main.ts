import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createServer as createViteServer } from 'vite';

import { createApiHandler } from './api.ts';
import { openHostContext } from './host-context.ts';
import { StartupError } from './startup-error.ts';

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
  const { abbreviations, databasePath, loadItems, repos, store, userId } = await openHostContext();

  const vite = await createViteServer({ configFile: VITE_CONFIG_PATH, server: { middlewareMode: true } });
  const handleApi = createApiHandler({ loadItems, abbreviations, repos, store, userId });
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
