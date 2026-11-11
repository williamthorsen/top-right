import { readFile } from 'node:fs/promises';

import { parseProjectUrl, type ProjectStatusOptions } from '@top-right/adapter-github';
import { z } from 'zod';

import { StartupError } from './startup-error.ts';

/** How many days back the host reads closed issues when the config file does not say. */
const DEFAULT_CLOSED_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PROJECT_URL_MESSAGE = 'expected a project URL, such as https://github.com/users/LOGIN/projects/1';

const optionListSchema = z.array(z.string().trim().min(1)).min(1);

const configSchema = z
  .object({
    repos: z
      .array(
        z.object({
          repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name'),
          abbreviation: z.unknown().optional(),
          project: z
            .string()
            .refine((url) => parseProjectUrl(url) !== undefined, PROJECT_URL_MESSAGE)
            .optional(),
        }),
      )
      .min(1),
    closedWindowDays: z.number().int().min(0).default(DEFAULT_CLOSED_WINDOW_DAYS),
    projects: z.record(z.string(), z.object({ toDo: optionListSchema, inProgress: optionListSchema })).default({}),
  })
  .superRefine((config, context) => {
    const named = new Set(config.repos.map((entry) => entry.project && canonicalizeProjectUrl(entry.project)));
    for (const url of Object.keys(config.projects)) {
      const canonical = canonicalizeProjectUrl(url);
      if (canonical === undefined)
        context.addIssue({ code: 'custom', path: ['projects', url], message: PROJECT_URL_MESSAGE });
      else if (!named.has(canonical)) {
        context.addIssue({ code: 'custom', path: ['projects', url], message: 'no repository names this project' });
      }
    }
  });

/**
 * The host's config: the repositories to read, as `owner/name`, how far back to read closed issues, and the GitHub
 * Project whose Status field supplies a repository's status.
 */
export interface HostConfig {
  /** The number of days back from each refresh within which a closed issue is read; 0 reads none. */
  closedWindowDays: number;
  /** The canonical URL of the project that each repository names, for the repositories that name one. */
  projectOf: Record<string, string>;
  /** The Status options that the config lists for a project, by its canonical URL. */
  projectOptions: Record<string, ProjectStatusOptions>;
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
export function formatAbbreviationNotice(config: Pick<HostConfig, 'reposWithAbbreviation'>): string | undefined {
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
  const { closedWindowDays, projects, repos } = parsed.data;
  const projectOf: Record<string, string> = {};
  for (const entry of repos) {
    const url = entry.project && canonicalizeProjectUrl(entry.project);
    if (url !== undefined) projectOf[entry.repo] = url;
  }
  const projectOptions: Record<string, ProjectStatusOptions> = {};
  for (const [url, options] of Object.entries(projects)) {
    const canonical = canonicalizeProjectUrl(url);
    if (canonical !== undefined) projectOptions[canonical] = options;
  }
  return {
    closedWindowDays,
    projectOf,
    projectOptions,
    repos: repos.map((entry) => entry.repo),
    reposWithAbbreviation: repos.filter((entry) => entry.abbreviation !== undefined).map((entry) => entry.repo),
  };
}

// region | Helpers
function canonicalizeProjectUrl(url: string): string | undefined {
  return parseProjectUrl(url)?.url;
}
// endregion | Helpers
