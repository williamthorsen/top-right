/** A problem that stops the host from starting, with a message that names the problem and the fix. */
export class StartupError extends Error {
  override name = 'StartupError';
}
