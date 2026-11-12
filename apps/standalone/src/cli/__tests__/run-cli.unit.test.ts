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
  createdAt: '2026-11-01T09:00:00Z',
  labels: [],
  relations: [],
};
const CLOSED_ITEM: WorkItem = { ...ITEM, number: 2, url: 'https://github.com/o/r/issues/2', state: 'closed' };
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

  it('lists the open items as JSON, leaving out the closed ones', async () => {
    const run = await runWith(['list-items', '--json']);

    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout)).toStrictEqual({
      items: [expect.objectContaining({ itemKey: 'o/r#1', scores: {} })],
    });
  });

  it('writes a batch as the agent’s and reports the changes', async () => {
    const run = await runWith(['write-scores', 'scores.json'], {
      files: { 'scores.json': '[{ "itemKey": "o/r#1", "scores": { "urgency": "high" } }]' },
    });

    expect(run.code).toBe(0);
    expect(run.stdout).toBe('o/r#1 urgency - → high\ntop-right: wrote 1 score on 1 item\n');
    expect(run.store.state.scores).toStrictEqual({
      'o/r#1': { urgency: { score: 'high', by: 'agent', at: NOW.toISOString() } },
    });
  });

  it.each([{ isDryRun: true }, { isDryRun: false }])(
    'when the item has a label for a level, reports from that level and skips a write of it (dry run: $isDryRun)',
    async ({ isDryRun }) => {
      const run = await runWith(['write-scores', ...(isDryRun ? ['--dry-run'] : []), 'scores.json'], {
        files: { 'scores.json': '[{ "itemKey": "o/r#1", "scores": { "urgency": "high", "value": "must-have" } }]' },
        labels: ['urgency:high', 'value:questionable'],
      });

      expect(run.code).toBe(0);
      expect(run.stdout).toMatch(/^o\/r#1 value questionable → must-have\ntop-right: /);
      expect(run.store.state.scores['o/r#1']?.urgency).toBeUndefined();
    },
  );

  it('reports the same changes on a dry run and writes nothing', async () => {
    const run = await runWith(['write-scores', '--dry-run', '-'], {
      stdin: '[{ "itemKey": "o/r#1", "scores": { "urgency": "high" } }]',
    });

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('o/r#1 urgency - → high\n');
    expect(run.store.state.scores).toStrictEqual({});
  });

  it('refuses a batch that names a loaded closed item or an unknown one, writes nothing, and exits 2', async () => {
    const run = await runWith(['write-scores', 'scores.json'], {
      files: {
        'scores.json':
          '[{ "itemKey": "o/r#1", "scores": { "urgency": "high" } }, { "itemKey": "o/r#2", "scores": { "value": "questionable" } }, { "itemKey": "o/r#3", "scores": { "value": "questionable" } }]',
      },
    });

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('entry 2: o/r#2 is not an open issue of a configured repository');
    expect(run.stderr).toContain('entry 3: o/r#3 is not an open issue of a configured repository');
    expect(run.store.state.scores).toStrictEqual({});
  });

  it('sets the abbreviations of repositories without a stored one, keeps the stored ones, and reports both', async () => {
    const run = await runWith(['seed-abbreviations', 'o/r=R1', 'o/s=S1'], {
      abbreviations: { 'o/s': 'SS', 'o/gone': 'G' },
    });

    expect(run.code).toBe(0);
    expect(run.stdout).toBe('o/r → R1\no/s left at SS (stored)\ntop-right: set 1 abbreviation; left 1 stored\n');
    expect(run.store.state.abbreviations).toStrictEqual({ 'o/s': 'SS', 'o/gone': 'G', 'o/r': 'R1' });
  });

  it('reports what a dry run would set and writes nothing', async () => {
    const run = await runWith(['seed-abbreviations', '--dry-run', 'o/r=R1']);

    expect(run.code).toBe(0);
    expect(run.stdout).toBe('o/r → R1\ntop-right: 1 abbreviation would be set; run without --dry-run to set them\n');
    expect(run.store.state.abbreviations).toStrictEqual({});
  });

  it.each([{ isDryRun: true }, { isDryRun: false }])(
    'refuses a seed that names an unconfigured repository, writes nothing, and exits 2 (dry run: $isDryRun)',
    async ({ isDryRun }) => {
      const run = await runWith(['seed-abbreviations', ...(isDryRun ? ['-n'] : []), 'o/r=R1', 'o/x=X']);

      expect(run.code).toBe(2);
      expect(run.stdout).toBe('');
      expect(run.stderr).toBe(
        'top-right seed-abbreviations: the batch is refused, and nothing was written:\n  argument 2: o/x is not a configured repository\n',
      );
      expect(run.store.state.abbreviations).toStrictEqual({});
    },
  );

  it('prints the seed-abbreviations help', async () => {
    const run = await runWith(['seed-abbreviations', '--help']);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('Usage: top-right seed-abbreviations [--dry-run] <owner/name=ABBR>...');
  });

  it('lists every command when an unknown one is not near any', async () => {
    const run = await runWith(['xyzzy']);

    expect(run.stderr).toBe(
      'top-right: unknown command xyzzy; the commands are list-items, seed-abbreviations, and write-scores; run top-right --help\n',
    );
  });

  it.each([
    {
      case: 'no pair is given',
      args: ['seed-abbreviations'],
      message: 'expects one or more owner/name=ABBR pairs',
    },
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
  /** The user's stored abbreviations. */
  abbreviations?: Record<string, string>;
  files?: Record<string, string>;
  /** The labels of the open item `o/r#1`. */
  labels?: string[];
  stdin?: string;
  isStdinTerminal?: boolean;
  failure?: Error;
}

/**
 * Runs the CLI against a memory store, with the repositories `o/r` and `o/s` configured and the open item `o/r#1` and
 * the closed `o/r#2` loaded, and returns its output and exit code.
 */
async function runWith(argv: string[], options: RunOptions = {}) {
  const store: MemoryStore = createMemoryStore({ abbreviations: options.abbreviations ?? {} });
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    version: '1.2.3',
    isStdinTerminal: options.isStdinTerminal ?? false,
    now: () => NOW,
    openContext: () => {
      if (options.failure instanceof StartupError) return Promise.reject(options.failure);
      return Promise.resolve({
        loadItems: () =>
          options.failure
            ? Promise.reject(options.failure)
            : Promise.resolve([{ ...ITEM, labels: options.labels ?? [] }, CLOSED_ITEM]),
        repos: ['o/r', 'o/s'],
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
