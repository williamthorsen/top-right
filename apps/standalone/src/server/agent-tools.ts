import { McpServer } from '@modelcontextprotocol/server';
import { DEFAULT_SCORE_LABEL_MAPPING, formatItemKey, type ItemScores, type WorkItem } from '@top-right/model';
import type { Store } from '@top-right/store';
import type { ToolServer } from '@williamthorsen/toolbelt.acp/proposed';
import { z } from 'zod';

import { listItems } from '#src/cli/list-items.ts';
import { scoresRequestSchema } from '#src/shared/write-requests.ts';

import { TOOL_SERVER_NAME } from './agent-profile.ts';
import type { ItemsCache } from './items-cache.ts';
import { type ScoreChange, submitScoreBatch } from './score-batch.ts';

/** A change that the agent suggested, with the reason that it gave for the item. */
export interface SuggestedChange extends ScoreChange {
  reason: string;
}

/** What the tools of one run read, where they write, and whom they tell about a suggestion. */
export interface AgentToolsOptions {
  items: ItemsCache;
  /** The configured repositories, as `owner/name`. */
  repos: readonly string[];
  store: Store;
  userId: string;
  /** The run's stamp, which every suggestion of the run carries. */
  at: string;
  /** Receives each accepted batch's changes and the resulting scores of each item that it wrote. */
  onSuggested: (changes: SuggestedChange[], scores: Record<string, ItemScores>) => void;
}

const listItemsInputSchema = z.object({
  repos: z.array(z.string()).optional().describe('The repositories to read, as owner/name; every one when omitted.'),
  parent: z.string().optional().describe('An item key, owner/name#number, whose sub-issues to read instead.'),
});

const suggestScoresInputSchema = z.object({
  changes: z
    .array(
      scoresRequestSchema.extend({
        reason: z.string().trim().min(1).describe('Why these scores fit the item, in one or two sentences.'),
      }),
    )
    .min(1),
});

/**
 * Returns the host's MCP server for one run: two tools that read the items that the host has read, and
 * `suggest_scores`, which records the agent's scores for the author's review. No tool writes to the source.
 */
export function createAgentTools(options: AgentToolsOptions): ToolServer {
  return { name: TOOL_SERVER_NAME, createServer: () => buildAgentToolServer(options) };
}

/** Returns a fresh MCP server with the run's three tools registered. */
export function buildAgentToolServer(options: AgentToolsOptions): McpServer {
  const server = new McpServer({ name: TOOL_SERVER_NAME, version: '1.0.0' });
  server.registerTool(
    'list_repos',
    { description: 'Lists the configured repositories with their count of open items and newest item’s date.' },
    async () => toText(await listRepos(options)),
  );
  server.registerTool(
    'list_items',
    {
      description:
        'Lists open items with their title, labels, parent, and current scores. With `parent`, lists that item’s sub-issues, open or recently closed, with their state.',
      inputSchema: listItemsInputSchema,
    },
    async (input) => {
      const listed = await listAgentItems(options, input);
      return listed.kind === 'refused' ? toError(listed.message) : toText(listed.items);
    },
  );
  server.registerTool(
    'suggest_scores',
    {
      description:
        'Records scores that you judge for open items, each with its reason, as suggestions that the author reviews; nothing changes at the source. Refuses the whole batch on any problem, naming each.',
      inputSchema: suggestScoresInputSchema,
    },
    async ({ changes }) => {
      const submission = await submitScoreBatch(options.store, options.userId, await readOpenItems(options), changes, {
        at: options.at,
        requiresLabels: true,
      });
      if (submission.kind === 'invalid') {
        return toError(`The batch is refused, and nothing was recorded:\n${submission.problems.join('\n')}`);
      }
      const reasons = new Map(submission.entries.map((entry) => [entry.itemKey, entry.reason ?? '']));
      const suggested = submission.changes.map((change) => ({
        ...change,
        reason: reasons.get(change.itemKey) ?? '',
      }));
      if (suggested.length > 0) options.onSuggested(suggested, submission.written);
      return toText({ recorded: suggested.length, items: Object.keys(submission.written).length });
    },
  );
  return server;
}

// region | Helpers
type ListAgentItemsResult = { kind: 'listed'; items: unknown[] } | { kind: 'refused'; message: string };

/** Returns the open items of `repos`, or the sub-issues of `parent`, with their scores. */
async function listAgentItems(
  options: AgentToolsOptions,
  input: z.infer<typeof listItemsInputSchema>,
): Promise<ListAgentItemsResult> {
  const unknownRepos = (input.repos ?? []).filter((repo) => !options.repos.includes(repo));
  if (unknownRepos.length > 0)
    return { kind: 'refused', message: `Not a configured repository: ${unknownRepos.join(', ')}` };
  const { items } = await options.items.get(input.repos ?? options.repos);
  const { scores, scoreLabelMapping } = await options.store.readUserState(options.userId);
  const mapping = scoreLabelMapping ?? DEFAULT_SCORE_LABEL_MAPPING;
  if (input.parent === undefined) {
    const open = items.filter((item) => item.state === 'open');
    return {
      kind: 'listed',
      items: listItems(open, scores, mapping).map((listed, index) => ({
        ...listed,
        parent: findParentKey(open[index]),
      })),
    };
  }
  const { items: allItems } = await options.items.get(options.repos);
  const byKey = new Map(allItems.map((item) => [formatItemKey(item), item]));
  const parent = byKey.get(input.parent);
  if (parent === undefined)
    return { kind: 'refused', message: `${input.parent} is not an item that the host has read` };
  const subIssues = parent.relations
    .filter((relation) => relation.kind === 'sub-issue')
    .flatMap((relation) => byKey.get(formatItemKey(relation.ref)) ?? []);
  return {
    kind: 'listed',
    items: listItems(subIssues, scores, mapping).map((listed, index) => ({
      ...listed,
      state: subIssues[index]?.state,
    })),
  };
}

/** Returns each configured repository with its count of open items and its newest item's creation time. */
async function listRepos({ items, repos }: AgentToolsOptions): Promise<unknown[]> {
  const read = await items.get(repos);
  return repos.map((repo) => {
    const open = read.items.filter((item) => item.repo === repo && item.state === 'open');
    const newestCreatedAt = open
      .map((item) => item.createdAt)
      .toSorted()
      .at(-1);
    return { repo, openCount: open.length, newestCreatedAt };
  });
}

/** Returns the key of the item's parent, or undefined when it has none. */
function findParentKey(item: WorkItem | undefined): string | undefined {
  const parent = item?.relations.find((relation) => relation.kind === 'parent');
  return parent && formatItemKey(parent.ref);
}

/** Returns the open items of every configured repository that the host has read. */
async function readOpenItems({ items, repos }: AgentToolsOptions): Promise<WorkItem[]> {
  return (await items.get(repos)).items.filter((item) => item.state === 'open');
}

/** Returns a tool result that reports `text` as a refusal, which the agent can correct. */
function toError(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/** Returns a tool result whose text is `value` as JSON. */
function toText(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}
// endregion | Helpers
