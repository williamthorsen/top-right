import {
  type CollectionSettings,
  describeAbbreviationClash,
  describeDuplicateLabel,
  describeDuplicateScoreLabel,
  describeInvalidAbbreviation,
  findAbbreviationClashes,
  findCollectionProblem,
  findDuplicateLabels,
  findDuplicateScoreLabels,
  isValidAbbreviation,
  normalizeScoreLabelMapping,
  normalizeWorkTypeMapping,
  resolveAbbreviations,
} from '@top-right/model';
import type { Store } from '@top-right/store';

import {
  abbreviationsRequestSchema,
  collectionsRequestSchema,
  scoreLabelMappingRequestSchema,
  type SettingsResponse,
  workTypeMappingRequestSchema,
} from '#src/shared/settings.ts';

import { readRequest, sendJson } from './http-json.ts';
import type { RouteTable } from './route-table.ts';

export const ABBREVIATIONS_PATH = '/api/abbreviations';
export const COLLECTIONS_PATH = '/api/collections';
export const SCORE_LABEL_MAPPING_PATH = '/api/score-label-mapping';
export const SETTINGS_PATH = '/api/settings';
export const WORK_TYPE_MAPPING_PATH = '/api/work-type-mapping';

export interface SettingsRoutesOptions {
  /** The absolute path of the config file that lists `repos`. */
  configPath: string;
  /** The configured repositories (`owner/name`). */
  repos: readonly string[];
  store: Store;
  /** The user whose settings the routes read and write. */
  userId: string;
}

/** Returns the routes that read and write the user's settings. */
export function createSettingsRoutes({ configPath, repos, store, userId }: SettingsRoutesOptions): RouteTable {
  const configuredRepos = new Set(repos);

  return {
    [ABBREVIATIONS_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, abbreviationsRequestSchema);
        if (!body) return;
        const entries = Object.entries(body.abbreviations).map(([repo, value]): [string, string] => [
          repo,
          value.trim(),
        ]);
        const unknownRepo = entries.find(([repo]) => !configuredRepos.has(repo));
        if (unknownRepo) {
          sendJson(response, 400, { error: `${unknownRepo[0]} is not a configured repository. Reload Settings.` });
          return;
        }
        const invalid = entries.find(([, value]) => value !== '' && !isValidAbbreviation(value));
        if (invalid) {
          sendJson(response, 400, { error: describeInvalidAbbreviation(...invalid) });
          return;
        }
        const { abbreviations: stored } = await store.readUserState(userId);
        const next = Object.fromEntries([
          ...Object.entries(stored).filter(([repo]) => !configuredRepos.has(repo)),
          ...entries.filter(([, value]) => value !== ''),
        ]);
        const [clash] = findAbbreviationClashes(resolveAbbreviations(repos, next));
        if (clash) {
          sendJson(response, 400, { error: describeAbbreviationClash(clash) });
          return;
        }
        await store.writeAbbreviations(userId, next);
        sendJson(response, 200, { abbreviations: next });
      },
    },
    [COLLECTIONS_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, collectionsRequestSchema);
        if (!body) return;
        const settings: CollectionSettings = {
          collections: body.collections.map((collection) => ({ ...collection, name: collection.name.trim() })),
          defaultCollectionId: body.defaultCollectionId ?? undefined,
        };
        const problem = findCollectionProblem(settings, repos);
        if (problem !== undefined) {
          sendJson(response, 400, { error: problem });
          return;
        }
        await store.writeCollections(userId, settings);
        sendJson(response, 200, { collections: settings.collections, defaultCollectionId: body.defaultCollectionId });
      },
    },
    [SCORE_LABEL_MAPPING_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, scoreLabelMappingRequestSchema);
        if (!body) return;
        const mapping = body.mapping === null ? undefined : normalizeScoreLabelMapping(body.mapping);
        const [duplicate] = mapping ? findDuplicateScoreLabels(mapping) : [];
        if (duplicate) {
          sendJson(response, 400, { error: describeDuplicateScoreLabel(duplicate) });
          return;
        }
        await store.writeScoreLabelMapping(userId, mapping);
        sendJson(response, 200, { mapping: mapping ?? null });
      },
    },
    [SETTINGS_PATH]: {
      method: 'GET',
      handle: async (_request, response) => {
        const state = await store.readUserState(userId);
        const body: SettingsResponse = {
          repos: [...repos],
          configPath,
          abbreviations: state.abbreviations,
          workTypeMapping: state.workTypeMapping ?? null,
          scoreLabelMapping: state.scoreLabelMapping ?? null,
          ...describeCollections(state.collections, configuredRepos),
        };
        sendJson(response, 200, body);
      },
    },
    [WORK_TYPE_MAPPING_PATH]: {
      method: 'POST',
      handle: async (request, response) => {
        const body = await readRequest(request, response, workTypeMappingRequestSchema);
        if (!body) return;
        const mapping = body.mapping === null ? undefined : normalizeWorkTypeMapping(body.mapping);
        const [duplicate] = mapping ? findDuplicateLabels(mapping) : [];
        if (duplicate) {
          sendJson(response, 400, { error: describeDuplicateLabel(duplicate) });
          return;
        }
        await store.writeWorkTypeMapping(userId, mapping);
        sendJson(response, 200, { mapping: mapping ?? null });
      },
    },
  };
}

/** Returns the collections and default of `settings` as a response states them, within the configured repositories. */
export function describeCollections(
  { collections, defaultCollectionId }: CollectionSettings,
  configuredRepos: ReadonlySet<string>,
): Pick<SettingsResponse, 'collections' | 'defaultCollectionId'> {
  return {
    collections: collections.map((collection) => ({
      ...collection,
      repos: collection.repos.filter((repo) => configuredRepos.has(repo)),
    })),
    defaultCollectionId: defaultCollectionId ?? null,
  };
}
