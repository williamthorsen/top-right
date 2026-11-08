import { describe, expect, it, vi } from 'vitest';

import { StartupError } from '../startup-error.ts';
import { resolveToken, type RunCommand } from '../token.ts';

describe(resolveToken, () => {
  it('when GITHUB_TOKEN is set, returns it without running gh', async () => {
    const runCommand = vi.fn<RunCommand>();

    await expect(resolveToken({ GITHUB_TOKEN: 'from-env' }, runCommand)).resolves.toBe('from-env');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('when GITHUB_TOKEN is unset, returns the trimmed output of gh auth token', async () => {
    const runCommand = vi.fn<RunCommand>(() => Promise.resolve('from-gh\n'));

    await expect(resolveToken({}, runCommand)).resolves.toBe('from-gh');
    expect(runCommand).toHaveBeenCalledWith('gh', ['auth', 'token']);
  });

  it.each([
    { case: 'gh fails', runCommand: () => Promise.reject(new Error('not logged in')) },
    { case: 'gh prints nothing', runCommand: () => Promise.resolve('') },
  ])('if $case, throws a StartupError that names both sources', async ({ runCommand }) => {
    const result = resolveToken({ GITHUB_TOKEN: ' ' }, runCommand);

    await expect(result).rejects.toThrow(StartupError);
    await expect(result).rejects.toThrow(/GITHUB_TOKEN.*gh auth login/);
  });
});
