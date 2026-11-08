import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { StartupError } from './startup-error.ts';

const configSchema = z.object({
  repos: z
    .array(
      z.object({
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name'),
        abbreviation: z.unknown().optional(),
      }),
    )
    .min(1),
});

/** The host's config: the repositories to read, as `owner/name`. */
export interface HostConfig {
  repos: string[];
  /** The repositories whose entry still sets `abbreviation`, which the host ignores. */
  reposWithAbbreviation: string[];
}

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

/** Returns the startup notice for config entries that still set `abbreviation`, or undefined when none does. */
export function formatAbbreviationNotice(config: HostConfig): string | undefined {
  if (config.reposWithAbbreviation.length === 0) return undefined;
  return `The config file's "abbreviation" is ignored (${config.reposWithAbbreviation.join(', ')}). Set abbreviations in Settings and remove the field.`;
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
  return {
    repos: parsed.data.repos.map((entry) => entry.repo),
    reposWithAbbreviation: parsed.data.repos
      .filter((entry) => entry.abbreviation !== undefined)
      .map((entry) => entry.repo),
  };
}
