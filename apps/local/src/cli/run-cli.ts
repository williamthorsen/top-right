import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

import { GitHubAdapterError } from '@top-right/adapter-github';
import { formatItemKey, type WorkItem } from '@top-right/model';
import type { Store } from '@top-right/store';

import { StartupError } from '#src/server/startup-error.ts';

import { listItems, renderItemsText } from './list-items.ts';
import { parseScoreBatch, planScoreChanges, renderChangesText, writeScoreBatch } from './write-scores.ts';

/** The user's store and items, opened for one run of the CLI. */
export interface CliContext {
  loadItems: () => Promise<WorkItem[]>;
  store: Store;
  userId: string;
  close: () => void;
}

/** The streams, inputs, and context that the CLI reads and writes. */
export interface CliIo {
  version: string;
  isStdinTerminal: boolean;
  now: () => Date;
  openContext: () => Promise<CliContext>;
  readFile: (path: string) => Promise<string>;
  readStdin: () => Promise<string>;
  stderr: (text: string) => void;
  stdout: (text: string) => void;
}

/** Runs the `top-right` CLI with `argv` (the arguments after the program) and returns the exit code. */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const [first, ...rest] = argv;
  if (first === undefined) {
    io.stderr(PROGRAM_HELP);
    return USAGE_ERROR;
  }
  if (first === '-h' || first === '--help') {
    io.stdout(PROGRAM_HELP);
    return 0;
  }
  if (first === '-V' || first === '--version') {
    io.stdout(`${io.version}\n`);
    return 0;
  }
  const command = COMMANDS.find((candidate) => candidate.name === first);
  if (!command) {
    io.stderr(
      `top-right: ${first.startsWith('-') ? `unknown option ${first}` : `unknown command ${first}`}; ${suggestCommand(first)}\n`,
    );
    return USAGE_ERROR;
  }
  if (rest.includes('-h') || rest.includes('--help')) {
    io.stdout(command.help);
    return 0;
  }
  try {
    return await command.run(rest, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`top-right ${command.name}: ${error.message}\n`);
      return USAGE_ERROR;
    }
    if (error instanceof StartupError || error instanceof GitHubAdapterError) {
      io.stderr(`top-right ${command.name}: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

// region | Helpers
const USAGE_ERROR = 2;

const LIST_ITEMS_HELP = `Print the open issues of the configured repositories with the user's current scores.

Usage: top-right list-items [--json]

Options:
  --json      Print { items: [{ itemKey, repo, number, title, url, labels, scores }] } on stdout
  -h, --help  Print this help

Example:
  pnpm --filter @top-right/local top-right list-items --json > items.json
`;

const WRITE_SCORES_HELP = `Write an agent's scores for open issues to the user's store, marked as the agent's for review.

Usage: top-right write-scores [--dry-run] <file>

Arguments:
  <file>         A JSON array of { "itemKey": "owner/name#number", "scores": { ... } }, or - to read stdin.
                 Scores: urgency and impact 1-5; effort 1, 2, 3, 5, 8, or 13; progress 0-1 in steps of 0.05.

Options:
  -n, --dry-run  Report each change, and write nothing
  -h, --help     Print this help

The whole batch is refused when any entry names an item that is not an open issue of a configured repository,
repeats an item, or holds a value off its scale.

Example:
  pnpm --filter @top-right/local top-right write-scores --dry-run scores.json
`;

const PROGRAM_HELP = `Read the backlog and write an agent's scores to the Top Right store.

Usage: top-right <command> [options]

Commands:
  list-items     Print the open issues with their current scores
  write-scores   Write an agent's scores for review on the chart

Options:
  -h, --help     Print help; top-right <command> --help prints the command's help
  -V, --version  Print the version

The store is TOP_RIGHT_DB when set, else $XDG_DATA_HOME/top-right/top-right.sqlite.

Example:
  pnpm --filter @top-right/local top-right list-items
`;

interface Command {
  name: string;
  help: string;
  run: (args: readonly string[], io: CliIo) => Promise<number>;
}

const COMMANDS: readonly Command[] = [
  { name: 'list-items', help: LIST_ITEMS_HELP, run: runListItems },
  { name: 'write-scores', help: WRITE_SCORES_HELP, run: runWriteScores },
];

/** A mistake in the invocation or its input, which exits 2. */
class UsageError extends Error {
  override name = 'UsageError';
}

/** Returns the number of single-character edits that turn `a` into `b`, comparing UTF-16 code units. */
function measureEditDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const substitution = (previous[j] ?? 0) + (a[i] === b[j] ? 0 : 1);
      current.push(Math.min((previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function parseCommandArgs<T extends ParseArgsOptionsConfig>(args: readonly string[], options: T) {
  try {
    return parseArgs({ args: [...args], options, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError(`${error instanceof Error ? error.message : String(error)}; run with --help for usage`);
  }
}

async function readBatchInput(path: string, io: CliIo): Promise<unknown> {
  let text: string;
  if (path === '-') {
    if (io.isStdinTerminal)
      throw new UsageError('- reads the batch from stdin, but stdin is a terminal; pipe the JSON in');
    text = await io.readStdin();
  } else {
    try {
      text = await io.readFile(path);
    } catch {
      throw new UsageError(`${path}: file not found or not readable`);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError(`${path === '-' ? 'stdin' : path}: not valid JSON`);
  }
}

async function runListItems(args: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseCommandArgs(args, { json: { type: 'boolean' } });
  if (positionals.length > 0) throw new UsageError(`takes no arguments, got ${positionals.join(' ')}`);
  await withContext(io, async (context) => {
    const items = await context.loadItems();
    const { scores } = await context.store.readUserState(context.userId);
    const listed = listItems(items, scores);
    io.stdout(values.json ? `${JSON.stringify({ items: listed }, undefined, 2)}\n` : renderItemsText(listed));
  });
  return 0;
}

async function runWriteScores(args: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseCommandArgs(args, { 'dry-run': { type: 'boolean', short: 'n' } });
  const [path, ...extra] = positionals;
  if (path === undefined) throw new UsageError('expects a <file> of scores, or - for stdin; run with --help for usage');
  if (extra.length > 0) throw new UsageError(`takes one <file>, got ${positionals.join(' ')}`);
  const json = await readBatchInput(path, io);
  const isDryRun = values['dry-run'] === true;
  return withContext(io, async (context) => {
    const items = await context.loadItems();
    const batch = parseScoreBatch(json, new Set(items.map((item) => formatItemKey(item))));
    if (batch.kind === 'invalid') {
      io.stderr(`top-right write-scores: the batch is refused, and nothing was written:\n`);
      io.stderr(batch.problems.map((problem) => `  ${problem}\n`).join(''));
      return USAGE_ERROR;
    }
    const at = io.now().toISOString();
    const { scores } = await context.store.readUserState(context.userId);
    const changes = planScoreChanges(batch.entries, scores, at);
    if (!isDryRun) await writeScoreBatch(context.store, context.userId, batch.entries, at);
    io.stdout(renderChangesText(changes, isDryRun));
    return 0;
  });
}

/** Returns a hint that names the nearest command, or lists the commands when none is near. */
function suggestCommand(input: string): string {
  const [nearest] = COMMANDS.map((command) => ({
    name: command.name,
    distance: measureEditDistance(input, command.name),
  })).toSorted((a, b) => a.distance - b.distance);
  if (nearest && nearest.distance <= 3) return `did you mean ${nearest.name}?`;
  return `the commands are ${COMMANDS.map((command) => command.name).join(' and ')}; run top-right --help`;
}

async function withContext<T>(io: CliIo, work: (context: CliContext) => Promise<T>): Promise<T> {
  const context = await io.openContext();
  try {
    return await work(context);
  } finally {
    context.close();
  }
}
// endregion | Helpers
