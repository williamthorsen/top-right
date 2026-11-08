import { readFile } from 'node:fs/promises';

import { abbreviate } from '@top-right/model';
import { z } from 'zod';

import { StartupError } from './startup-error.ts';

const configSchema = z.object({
  repos: z
    .array(
      z.object({
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name'),
        abbreviation: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export type HostConfig = z.infer<typeof configSchema>;

/** Reads and validates the host's config file. */
export async function readConfig(path: string): Promise<HostConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new StartupError(
      `Config file not found: ${path}. Copy config.example.json to config.local.json and list your repositories.`,
    );
  }
  return parseConfig(text, path);
}

/** Parses the text of a config file, naming the file in any error. */
export function parseConfig(text: string, path: string): HostConfig {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new StartupError(`Config file is not valid JSON: ${path}.`);
  }
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new StartupError(`Config file is invalid: ${path}. ${issues}.`);
  }
  return parsed.data;
}

/**
 * Returns each repository's abbreviation, the configured one or its first letter, keyed by `owner/name`. Two
 * repositories whose abbreviations match case-insensitively make the ids ambiguous, so they stop the host.
 */
export function resolveAbbreviations(config: HostConfig): Record<string, string> {
  const abbreviations: Record<string, string> = {};
  const reposByAbbreviation = new Map<string, string[]>();
  for (const { repo, abbreviation = abbreviate(repo) } of config.repos) {
    abbreviations[repo] = abbreviation;
    const key = abbreviation.toLowerCase();
    reposByAbbreviation.set(key, [...(reposByAbbreviation.get(key) ?? []), repo]);
  }
  const clashes = [...reposByAbbreviation].filter(([, repos]) => repos.length > 1);
  if (clashes.length > 0) {
    const listed = clashes.map(([key, repos]) => `"${key}" (${repos.join(', ')})`).join('; ');
    throw new StartupError(
      `Repositories share an abbreviation: ${listed}. Give each an "abbreviation" in the config file.`,
    );
  }
  return abbreviations;
}
