import { StartupError } from './startup-error.ts';

/** Runs a command and resolves to its standard output; rejects when the command fails. */
export type RunCommand = (command: string, args: readonly string[]) => Promise<string>;

/** Returns the GitHub token from `GITHUB_TOKEN`, else from `gh auth token`. */
export async function resolveToken(env: NodeJS.ProcessEnv, runCommand: RunCommand): Promise<string> {
  const fromEnv = env['GITHUB_TOKEN']?.trim();
  if (fromEnv) return fromEnv;

  let fromGh = '';
  try {
    fromGh = (await runCommand('gh', ['auth', 'token'])).trim();
  } catch {
    // Fall through to the error below, which names both sources.
  }
  if (!fromGh) throw new StartupError('No GitHub token found. Set GITHUB_TOKEN, or run `gh auth login`.');
  return fromGh;
}
