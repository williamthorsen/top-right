import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

/** A tool's answer: its text, parsed as JSON when it is JSON, and whether the tool refused the call. */
export interface ToolAnswer {
  isError: boolean;
  text: string;
  json: unknown;
}

const toolResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
});

/** Connects an MCP client to `server` in memory, and returns the function that calls one of its tools. */
export async function connectToolClient(
  server: McpServer,
): Promise<(name: string, args?: Record<string, unknown>) => Promise<ToolAnswer>> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return async (name, args = {}) => {
    const result = toolResultSchema.parse(await client.callTool({ name, arguments: args }));
    const text = result.content.map((block) => block.text).join('');
    return { isError: result.isError ?? false, text, json: parseJson(text) };
  };
}

// region | Helpers
/** Returns `text` parsed as JSON, or undefined when it is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
// endregion | Helpers
