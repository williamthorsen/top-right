import path from 'node:path';

/**
 * Returns the path of the host's SQLite file: `TOP_RIGHT_DB` when set, else `top-right/top-right.sqlite` under
 * `XDG_DATA_HOME`, else under `~/.local/share`. The default lies outside the repository, so that every worktree
 * reads one store.
 */
export function resolveDatabasePath(env: Readonly<Record<string, string | undefined>>, homeDirectory: string): string {
  const explicit = env['TOP_RIGHT_DB']?.trim();
  if (explicit) return explicit;
  const dataHome = env['XDG_DATA_HOME']?.trim() || path.join(homeDirectory, '.local', 'share');
  return path.join(dataHome, 'top-right', 'top-right.sqlite');
}
