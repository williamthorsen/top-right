import { createRequire } from 'node:module';
import path from 'node:path';

import {
  type AgentProfile,
  antigravityProfile,
  claudeCodeProfile,
  type PermissionPolicy,
  type PermissionVerdict,
  type RequestPermissionRequest,
} from '@williamthorsen/toolbelt.acp/proposed';
import { z } from 'zod';

import type { AgentConfig } from './config.ts';

/** The name of the host's MCP server in the agent's session. */
export const TOOL_SERVER_NAME = 'topright';

/** The tools of the host's MCP server, the only tools that the permission policy allows. */
export const AGENT_TOOL_NAMES = ['list_items', 'list_repos', 'suggest_scores'] as const;

const claudeToolCallMetaSchema = z.object({
  claudeCode: z.object({ mcpServer: z.object({ name: z.string() }) }),
});

/**
 * Returns the profile that starts the configured harness. Claude Code runs the adapter that the host depends on, with
 * the host's Node, unless the config names a command.
 */
export function buildAgentProfile(agent: AgentConfig): AgentProfile {
  if (agent.harness === 'antigravity') {
    return antigravityProfile(agent.command === undefined ? {} : { command: agent.command });
  }
  const profile = claudeCodeProfile(agent.model === undefined ? {} : { model: agent.model });
  return agent.command === undefined
    ? { ...profile, command: process.execPath, args: [resolveClaudeAdapterBin()] }
    : { ...profile, command: agent.command };
}

/**
 * Returns the policy that allows each call of a tool of the host's MCP server and refuses every other request, matched
 * as the harness names the server: Claude Code in the tool call's metadata, and Antigravity in the tool call's title.
 */
export function buildPermissionPolicy(agent: AgentConfig): PermissionPolicy {
  if (agent.harness === 'antigravity') {
    const titles = new Set(AGENT_TOOL_NAMES.map((tool) => `Run mcp_${TOOL_SERVER_NAME}_${tool}`));
    return ({ toolCall }) => (typeof toolCall.title === 'string' && titles.has(toolCall.title) ? 'allow' : undefined);
  }
  return allowClaudeToolCall;
}

// region | Helpers
/** Allows a Claude Code tool call whose metadata names the host's MCP server. */
function allowClaudeToolCall({ toolCall }: RequestPermissionRequest): PermissionVerdict | undefined {
  const meta = claudeToolCallMetaSchema.safeParse(toolCall._meta);
  return meta.success && meta.data.claudeCode.mcpServer.name === TOOL_SERVER_NAME ? 'allow' : undefined;
}

/** Returns the path of the `claude-agent-acp` bin of the adapter that the host depends on. */
function resolveClaudeAdapterBin(): string {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('@agentclientprotocol/claude-agent-acp/package.json');
  const manifest = z.object({ bin: z.record(z.string(), z.string()) }).parse(require(manifestPath));
  const bin = manifest.bin['claude-agent-acp'];
  if (bin === undefined) throw new Error('@agentclientprotocol/claude-agent-acp does not declare its bin');
  return path.join(path.dirname(manifestPath), bin);
}
// endregion | Helpers
