import { z } from 'zod';

const labelsSchema = z.array(z.string()).readonly();

/** The labels that assign each work type. */
export const workTypeMappingSchema = z.object({
  bug: labelsSchema,
  feature: labelsSchema,
  ops: labelsSchema,
  task: labelsSchema,
});

/** The labels that supply each urgency level, each value level, and each effort on the scale. */
export const scoreLabelMappingSchema = z.object({
  urgency: z.object({ critical: labelsSchema, high: labelsSchema, low: labelsSchema, medium: labelsSchema }),
  value: z.object({
    'must-have': labelsSchema,
    'nice-to-have': labelsSchema,
    questionable: labelsSchema,
    'should-have': labelsSchema,
  }),
  effort: z.object({
    1: labelsSchema,
    2: labelsSchema,
    3: labelsSchema,
    5: labelsSchema,
    8: labelsSchema,
    13: labelsSchema,
  }),
});

/** Repositories whose abbreviations match case-insensitively. */
export const abbreviationClashSchema = z.object({ abbreviation: z.string(), repos: z.array(z.string()) });

/** A named group of configured repositories. */
export const collectionSchema = z.object({ id: z.string(), name: z.string(), repos: z.array(z.string()) });

/** The body of a successful `GET /api/settings`. */
export const settingsResponseSchema = z.object({
  /** The configured repositories, as `owner/name`. */
  repos: z.array(z.string()),
  /** The absolute path of the config file from which the host read `repos`. */
  configPath: z.string(),
  /** The user's stored abbreviations; a configured repository without one takes its uppercase first letter. */
  abbreviations: z.record(z.string(), z.string()),
  /** The user's saved mapping, or `null` when the user keeps the default. */
  workTypeMapping: workTypeMappingSchema.nullable(),
  /** The user's saved score-label mapping, or `null` when the user keeps the default. */
  scoreLabelMapping: scoreLabelMappingSchema.nullable(),
  /** The user's collections, each without the repositories that the config does not list. */
  collections: z.array(collectionSchema),
  /** The id of the collection that the chart starts at, or `null` for every repository. */
  defaultCollectionId: z.string().nullable(),
});

/** The body of `POST /api/work-type-mapping`: the mapping to save, or `null` to restore the default. */
export const workTypeMappingRequestSchema = z.object({ mapping: workTypeMappingSchema.nullable() });

/** The body of `POST /api/score-label-mapping`: the mapping to save, or `null` to restore the default. */
export const scoreLabelMappingRequestSchema = z.object({ mapping: scoreLabelMappingSchema.nullable() });

/** The body of `POST /api/abbreviations`: each configured repository's abbreviation, empty for its default. */
export const abbreviationsRequestSchema = z.object({ abbreviations: z.record(z.string(), z.string()) });

/** The body of `POST /api/collections`: the user's collections and default collection, replacing the saved ones. */
export const collectionsRequestSchema = z.object({
  collections: z.array(collectionSchema),
  defaultCollectionId: z.string().nullable(),
});

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

/** The body of a successful `POST /api/work-type-mapping`: the saved mapping, or `null` for the default. */
export const workTypeMappingResponseSchema = workTypeMappingRequestSchema;

/** The body of a successful `POST /api/score-label-mapping`: the saved mapping, or `null` for the default. */
export const scoreLabelMappingResponseSchema = scoreLabelMappingRequestSchema;

/** The body of a successful `POST /api/collections`: the saved collections and default collection. */
export const collectionsResponseSchema = collectionsRequestSchema;

/** The body of a successful `POST /api/abbreviations`: the user's stored abbreviations. */
export const abbreviationsResponseSchema = abbreviationsRequestSchema;
