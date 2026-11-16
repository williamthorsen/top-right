import { existsSync } from 'node:fs';

import type { RequestPermissionRequest } from '@williamthorsen/toolbelt.acp/proposed';
import { describe, expect, it } from 'vitest';

import { buildAgentProfile, buildPermissionPolicy } from '../agent-profile.ts';

const SIGNAL = new AbortController().signal;

describe(buildAgentProfile, () => {
  it('runs the Claude adapter that the host depends on with the host’s Node', () => {
    const profile = buildAgentProfile({ harness: 'claude-code', model: 'sonnet' });

    expect(profile.command).toBe(process.execPath);
    expect(profile.args).toHaveLength(1);
    expect(existsSync(profile.args?.[0] ?? '')).toBe(true);
    expect(JSON.stringify(profile.sessionMeta)).toContain('"model":"sonnet"');
  });

  it('runs the command that the config names', () => {
    expect(buildAgentProfile({ harness: 'claude-code', command: '/opt/claude-agent-acp' })).toMatchObject({
      command: '/opt/claude-agent-acp',
    });
    expect(buildAgentProfile({ harness: 'antigravity', command: '/opt/agy' })).toMatchObject({ command: '/opt/agy' });
  });
});

describe(buildPermissionPolicy, () => {
  it.each([
    { case: 'a tool of the host’s server', server: 'topright', verdict: 'allow' },
    { case: 'a tool of another server', server: 'other', verdict: undefined },
  ])('answers Claude Code’s request for $case', ({ server, verdict }) => {
    const policy = buildPermissionPolicy({ harness: 'claude-code' });

    expect(policy(buildRequest({ _meta: { claudeCode: { mcpServer: { name: server } } } }), { signal: SIGNAL })).toBe(
      verdict,
    );
  });

  it('refuses a Claude Code built-in tool, which names no server', () => {
    const policy = buildPermissionPolicy({ harness: 'claude-code' });

    expect(policy(buildRequest({ title: 'Read', kind: 'read' }), { signal: SIGNAL })).toBeUndefined();
  });

  it.each([
    { title: 'Run mcp_topright_suggest_scores', verdict: 'allow' },
    { title: 'Run mcp_topright_write_labels', verdict: undefined },
    { title: 'Run mcp_other_list_items', verdict: undefined },
    { title: 'Read file', verdict: undefined },
  ])('answers Antigravity’s request titled "$title"', ({ title, verdict }) => {
    const policy = buildPermissionPolicy({ harness: 'antigravity' });

    expect(policy(buildRequest({ title }), { signal: SIGNAL })).toBe(verdict);
  });
});

// region | Helpers
/** Returns a permission request for one tool call with the given fields. */
function buildRequest(toolCall: Partial<RequestPermissionRequest['toolCall']>): RequestPermissionRequest {
  return {
    sessionId: 'session',
    options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }],
    toolCall: { toolCallId: 'call', ...toolCall },
  };
}
// endregion | Helpers
