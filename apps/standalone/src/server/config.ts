import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { StartupError } from './startup-error.ts';

/** How many days back the host reads closed issues when the config file does not say. */
const DEFAULT_CLOSED_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const configSchema = z.object({
  repos: z
    .array(
      z.object({
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name'),
        abbreviation: z.unknown().optional(),
      }),
    )
    .min(1),
  closedWindowDays: z.number().int().min(0).default(DEFAULT_CLOSED_WINDOW_DAYS),
});

/** The host's config: the repositories to read, as `owner/name`, and how far back to read closed issues. */
export interface HostConfig {
  /** The number of days back from each refresh within which a closed issue is read; 0 reads none. */
  closedWindowDays: number;
  repos: string[];
  /** The repositories whose entry still sets `abbreviation`, which the host ignores. */
  reposWithAbbreviation: string[];
}

/** Returns the moment from which a refresh at `now` reads closed issues, or undefined when it reads none. */
export function computeClosedSince(now: Date, closedWindowDays: number): Date | undefined {
  return closedWindowDays === 0 ? undefined : new Date(now.getTime() - closedWindowDays * MS_PER_DAY);
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
    closedWindowDays: parsed.data.closedWindowDays,
    repos: parsed.data.repos.map((entry) => entry.repo),
    reposWithAbbreviation: parsed.data.repos
      .filter((entry) => entry.abbreviation !== undefined)
      .map((entry) => entry.repo),
  };
}
