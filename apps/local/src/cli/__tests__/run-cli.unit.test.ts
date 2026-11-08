import { GitHubAdapterError } from '@top-right/adapter-github';
import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { StartupError } from '#src/server/startup-error.ts';
import { createMemoryStore, type MemoryStore } from '#src/test-utils/memory-store.ts';

import { type CliIo, runCli } from '../run-cli.ts';

const ITEM: WorkItem = {
  repo: 'o/r',
  number: 1,
  title: 'Plot the issues',
  url: 'https://github.com/o/r/issues/1',
  state: 'open',
  labels: [],
  relations: [],
};
const NOW = new Date('2026-11-08T12:00:00.000Z');

describe(runCli, () => {
  it.each([['--help'], ['-h']])('prints the program help on stdout for %s and exits 0', async (flag) => {
    const run = await runWith([flag]);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('Usage: top-right <command>');
  });

  it('prints a command’s help before validating its arguments', async () => {
    const run = await runWith(['write-scores', '--bogus', '--help']);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('Usage: top-right write-scores');
  });

  it('prints the version for -V', async () => {
    expect(await runWith(['-V'])).toMatchObject({ code: 0, stdout: '1.2.3\n' });
  });

  it('prints the help on stderr and exits 2 without a command', async () => {
    const run = await runWith([]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('Usage: top-right <command>');
  });

  it('suggests the nearest command for a typo and exits 2', async () => {
    expect(await runWith(['list-item'])).toMatchObject({
      code: 2,
      stderr: 'top-right: unknown command list-item; did you mean list-items?\n',
    });
  });

  it('exits 2 for an unknown option of a command', async () => {
    const run = await runWith(['list-items', '--yaml']);

    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/^top-right list-items: .*--yaml/);
  });

  it('lists the items as JSON', async () => {
    const run = await runWith(['list-items', '--json']);

    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ items: [{ itemKey: 'o/r#1', scores: {} }] });
  });

  it('writes a batch as the agent’s and reports the changes', async () => {
    const run = await runWith(['write-scores', 'scores.json'], {
      files: { 'scores.json': '[{ "itemKey": "o/r#1", "scores": { "urgency": 4 } }]' },
    });

    expect(run.code).toBe(0);
    expect(run.stdout).toBe('o/r#1 urgency - → 4\ntop-right: wrote 1 score on 1 item\n');
    expect(run.store.state.scores).toStrictEqual({
      'o/r#1': { urgency: { value: 4, by: 'agent', at: NOW.toISOString() } },
    });
  });

  it('reports the same changes on a dry run and writes nothing', async () => {
    const run = await runWith(['write-scores', '--dry-run', '-'], {
      stdin: '[{ "itemKey": "o/r#1", "scores": { "urgency": 4 } }]',
    });

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('o/r#1 urgency - → 4\n');
    expect(run.store.state.scores).toStrictEqual({});
  });

  it('refuses a batch that names a closed or unknown item, writes nothing, and exits 2', async () => {
    const run = await runWith(['write-scores', 'scores.json'], {
      files: {
        'scores.json':
          '[{ "itemKey": "o/r#1", "scores": { "urgency": 4 } }, { "itemKey": "o/r#2", "scores": { "impact": 1 } }]',
      },
    });

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('entry 2: o/r#2 is not an open issue of a configured repository');
    expect(run.store.state.scores).toStrictEqual({});
  });

  it.each([
    { case: 'the file is missing', args: ['write-scores', 'missing.json'], message: 'missing.json: file not found' },
    { case: 'the file is not JSON', args: ['write-scores', 'bad.json'], message: 'bad.json: not valid JSON' },
    { case: 'stdin is a terminal', args: ['write-scores', '-'], message: 'stdin is a terminal' },
    { case: 'no file is given', args: ['write-scores'], message: 'expects a <file>' },
  ])('exits 2 when $case', async ({ args, message }) => {
    const run = await runWith(args, { files: { 'bad.json': '{' }, isStdinTerminal: true });

    expect(run.code).toBe(2);
    expect(run.stderr).toContain(message);
  });

  it.each([
    { case: 'the host context fails to open', error: new StartupError('No GitHub token found.') },
    { case: 'the issues fail to load', error: new GitHubAdapterError('rate limited') },
  ])('reports and exits 1 when $case', async ({ error }) => {
    const run = await runWith(['list-items'], { failure: error });

    expect(run.code).toBe(1);
    expect(run.stderr).toBe(`top-right list-items: ${error.message}\n`);
  });
});

// region | Helpers
interface RunOptions {
  files?: Record<string, string>;
  stdin?: string;
  isStdinTerminal?: boolean;
  failure?: Error;
}

/** Runs the CLI against a memory store holding the open item `o/r#1`, and returns its output and exit code. */
async function runWith(argv: string[], options: RunOptions = {}) {
  const store: MemoryStore = createMemoryStore();
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    version: '1.2.3',
    isStdinTerminal: options.isStdinTerminal ?? false,
    now: () => NOW,
    openContext: () => {
      if (options.failure instanceof StartupError) return Promise.reject(options.failure);
      return Promise.resolve({
        loadItems: () => (options.failure ? Promise.reject(options.failure) : Promise.resolve([ITEM])),
        store,
        userId: 'github:author',
        close: () => {},
      });
    },
    readFile: (path) => {
      const content = options.files?.[path];
      return content === undefined ? Promise.reject(new Error('ENOENT')) : Promise.resolve(content);
    },
    readStdin: () => Promise.resolve(options.stdin ?? ''),
    stderr: (text) => {
      stderr += text;
    },
    stdout: (text) => {
      stdout += text;
    },
  };
  const code = await runCli(argv, io);
  return { code, stdout, stderr, store };
}
// endregion | Helpers
