import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createServer as createViteServer } from 'vite';

import { createApiHandler } from './api.ts';
import { openHostContext } from './host-context.ts';
import { createItemsCache, type ItemsCache } from './items-cache.ts';
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
  const { configPath, databasePath, labelWriter, loadItems, repos, statusStrategyFor, store, userId } =
    await openHostContext();

  const vite = await createViteServer({ configFile: VITE_CONFIG_PATH, server: { middlewareMode: true } });
  const items = createItemsCache({ load: loadItems });
  // Start the first read now, so that the first load waits only for what remains of it.
  void startFirstRead(items);
  const handleApi = createApiHandler({ configPath, items, labelWriter, repos, statusStrategyFor, store, userId });
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
/** Reads the issues into the cache, logging a failure, which the next load retries. */
async function startFirstRead(items: ItemsCache): Promise<void> {
  try {
    await items.refresh();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`top-right: the first read of issues failed: ${reason}`);
  }
}
// endregion | Helpers
