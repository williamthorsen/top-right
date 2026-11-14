import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

import { GitHubAdapterError } from '@top-right/adapter-github';
import {
  DEFAULT_SCORE_LABEL_MAPPING,
  formatItemKey,
  type ResolvedItemScores,
  resolveItemScores,
  type WorkItem,
} from '@top-right/model';
import type { Store } from '@top-right/store';
import { describeError } from '@williamthorsen/toolbelt.errors';

import { StartupError } from '#src/server/startup-error.ts';

import { listItems, renderItemsText } from './list-items.ts';
import { planAbbreviationSeed, renderSeedText } from './seed-abbreviations.ts';
import {
  omitHeldScores,
  parseScoreBatch,
  planScoreChanges,
  renderChangesText,
  writeScoreBatch,
} from './write-scores.ts';

/** The user's store and items, opened for one run of the CLI. */
export interface CliContext {
  loadItems: () => Promise<WorkItem[]>;
  /** The configured repositories, as `owner/name`. */
  repos: string[];
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
A score that a label supplies, where none is stored, is marked "(label)" in the text and by: "label" in the JSON.

Usage: top-right list-items [--json]

Options:
  --json      Print { items: [{ itemKey, repo, number, title, url, labels, scores }] } on stdout
  -h, --help  Print this help

Example:
  pnpm --filter @top-right/standalone top-right list-items --json > items.json
`;

const SEED_ABBREVIATIONS_HELP = `Set the abbreviations of configured repositories that do not have a stored one yet.
A stored abbreviation is never changed; change one on the Settings page.

Usage: top-right seed-abbreviations [--dry-run] <owner/name=ABBR>...

Arguments:
  <owner/name=ABBR>  A configured repository and the abbreviation that leads its ids, such as T in T.11.
                     An abbreviation holds no spaces or dots.

Options:
  -n, --dry-run      Report what would be set, and write nothing
  -h, --help         Print this help

The whole batch is refused when any pair is malformed, repeats a repository, names a repository that is not
configured, holds an invalid abbreviation, or would leave a repository that it sets sharing an abbreviation with
another configured repository, compared case-insensitively.

Example:
  pnpm --filter @top-right/standalone top-right seed-abbreviations owner/top-right=TR owner/toolbelt=TB
`;

const WRITE_SCORES_HELP = `Write an agent's scores for open issues to the user's store, marked as the agent's for review.

Usage: top-right write-scores [--dry-run] <file>

Arguments:
  <file>         A JSON array of { "itemKey": "owner/name#number", "scores": { ... } }, or - to read stdin.
                 Scores: urgency critical, high, medium, or low; value must-have, should-have,
                 nice-to-have, or questionable; effort 1, 2, 3, 5, 8, or 13; progress 0-1 in steps of 0.05.

Options:
  -n, --dry-run  Report each change, and write nothing
  -h, --help     Print this help

The whole batch is refused when any entry names an item that is not an open issue of a configured repository,
repeats an item, or holds a value off its scale.

A score equal to the one that the item already has, stored or supplied by a label, is neither reported nor written.
The agent's scores never change an issue's labels; the author's review on the chart writes them.

Example:
  pnpm --filter @top-right/standalone top-right write-scores --dry-run scores.json
`;

const PROGRAM_HELP = `Read the backlog and write an agent's scores to the Top Right store.

Usage: top-right <command> [options]

Commands:
  list-items          Print the open issues with their current scores
  seed-abbreviations  Set the abbreviations of repositories that do not have one
  write-scores        Write an agent's scores for review on the chart

Options:
  -h, --help          Print help; top-right <command> --help prints the command's help
  -V, --version       Print the version

The store is TOP_RIGHT_DB when set, else $XDG_DATA_HOME/top-right/top-right.sqlite.

Example:
  pnpm --filter @top-right/standalone top-right list-items
`;

interface Command {
  name: string;
  help: string;
  run: (args: readonly string[], io: CliIo) => Promise<number>;
}

const COMMANDS: readonly Command[] = [
  { name: 'list-items', help: LIST_ITEMS_HELP, run: runListItems },
  { name: 'seed-abbreviations', help: SEED_ABBREVIATIONS_HELP, run: runSeedAbbreviations },
  { name: 'write-scores', help: WRITE_SCORES_HELP, run: runWriteScores },
];

/** A mistake in the invocation or its input, which exits 2. */
class UsageError extends Error {
  override name = 'UsageError';
}

/** Joins `names` as an English list: `a`, `a and b`, or `a, b, and c`. */
function formatList(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1) ?? ''}`;
}

/** Reads the items and keeps the open ones, since the CLI scores only items open at their source. */
async function loadOpenItems(context: CliContext): Promise<WorkItem[]> {
  return (await context.loadItems()).filter((item) => item.state === 'open');
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
    throw new UsageError(`${describeError(error)}; run with --help for usage`);
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
    const items = await loadOpenItems(context);
    const { scores, scoreLabelMapping } = await context.store.readUserState(context.userId);
    const listed = listItems(items, scores, scoreLabelMapping ?? DEFAULT_SCORE_LABEL_MAPPING);
    io.stdout(values.json ? `${JSON.stringify({ items: listed }, undefined, 2)}\n` : renderItemsText(listed));
  });
  return 0;
}

async function runSeedAbbreviations(args: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseCommandArgs(args, { 'dry-run': { type: 'boolean', short: 'n' } });
  if (positionals.length === 0)
    throw new UsageError('expects one or more owner/name=ABBR pairs; run with --help for usage');
  const isDryRun = values['dry-run'] === true;
  return withContext(io, async (context) => {
    const { abbreviations } = await context.store.readUserState(context.userId);
    const plan = planAbbreviationSeed(positionals, context.repos, abbreviations);
    if (plan.kind === 'invalid') {
      io.stderr(`top-right seed-abbreviations: the batch is refused, and nothing was written:\n`);
      io.stderr(plan.problems.map((problem) => `  ${problem}\n`).join(''));
      return USAGE_ERROR;
    }
    if (!isDryRun && plan.set.length > 0) await context.store.writeAbbreviations(context.userId, plan.next);
    io.stdout(renderSeedText(plan, isDryRun));
    return 0;
  });
}

async function runWriteScores(args: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseCommandArgs(args, { 'dry-run': { type: 'boolean', short: 'n' } });
  const [path, ...extra] = positionals;
  if (path === undefined) throw new UsageError('expects a <file> of scores, or - for stdin; run with --help for usage');
  if (extra.length > 0) throw new UsageError(`takes one <file>, got ${positionals.join(' ')}`);
  const json = await readBatchInput(path, io);
  const isDryRun = values['dry-run'] === true;
  return withContext(io, async (context) => {
    const items = await loadOpenItems(context);
    const batch = parseScoreBatch(json, new Set(items.map((item) => formatItemKey(item))));
    if (batch.kind === 'invalid') {
      io.stderr(`top-right write-scores: the batch is refused, and nothing was written:\n`);
      io.stderr(batch.problems.map((problem) => `  ${problem}\n`).join(''));
      return USAGE_ERROR;
    }
    const at = io.now().toISOString();
    const { scores, scoreLabelMapping } = await context.store.readUserState(context.userId);
    const mapping = scoreLabelMapping ?? DEFAULT_SCORE_LABEL_MAPPING;
    const resolved = Object.fromEntries(
      items.map((item): [string, ResolvedItemScores] => {
        const itemKey = formatItemKey(item);
        return [itemKey, resolveItemScores(scores[itemKey], item.labels, mapping)];
      }),
    );
    const entries = omitHeldScores(batch.entries, resolved);
    const changes = planScoreChanges(entries, scores, resolved, at);
    if (!isDryRun) await writeScoreBatch(context.store, context.userId, entries, at);
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
  return `the commands are ${formatList(COMMANDS.map((command) => command.name))}; run top-right --help`;
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
