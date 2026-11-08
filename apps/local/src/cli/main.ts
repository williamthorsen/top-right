import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';

import { z } from 'zod';

import { openHostContext } from '#src/server/host-context.ts';

import { runCli } from './run-cli.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    version: readVersion(),
    isStdinTerminal: process.stdin.isTTY,
    now: () => new Date(),
    openContext: async () => {
      const { loadItems, store, userId } = await openHostContext();
      return { loadItems, store, userId, close: () => store.close() };
    },
    readFile: (path) => readFile(path, 'utf8'),
    readStdin: () => text(process.stdin),
    stderr: (output) => process.stderr.write(output),
    stdout: (output) => process.stdout.write(output),
  });
} catch (error) {
  reportCrash(error);
  process.exitCode = 1;
}

// region | Helpers
function readVersion(): string {
  const packageJson: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  return z.object({ version: z.string() }).parse(packageJson).version;
}

function reportCrash(error: unknown): void {
  if (error instanceof Error) {
    process.stderr.write(`top-right: internal error: ${error.message}\n${error.stack ?? ''}\n`);
  } else {
    process.stderr.write(`top-right: internal error: ${String(error)}\n`);
  }
}
// endregion | Helpers
