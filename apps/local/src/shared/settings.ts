import { z } from 'zod';

const labelsSchema = z.array(z.string()).readonly();

/** The labels that assign each work type. */
export const workTypeMappingSchema = z.object({
  bug: labelsSchema,
  feature: labelsSchema,
  ops: labelsSchema,
  task: labelsSchema,
});

/** Repositories whose abbreviations match case-insensitively. */
export const abbreviationClashSchema = z.object({ abbreviation: z.string(), repos: z.array(z.string()) });

/** The body of a successful `GET /api/settings`. */
export const settingsResponseSchema = z.object({
  /** The configured repositories, as `owner/name`. */
  repos: z.array(z.string()),
  /** The user's stored abbreviations; a configured repository without one takes its first letter. */
  abbreviations: z.record(z.string(), z.string()),
  /** The user's saved mapping, or `null` when the user keeps the default. */
  workTypeMapping: workTypeMappingSchema.nullable(),
});

/** The body of `POST /api/work-type-mapping`: the mapping to save, or `null` to restore the default. */
export const workTypeMappingRequestSchema = z.object({ mapping: workTypeMappingSchema.nullable() });

/** The body of `POST /api/abbreviations`: each configured repository's abbreviation, empty for its default. */
export const abbreviationsRequestSchema = z.object({ abbreviations: z.record(z.string(), z.string()) });

export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

/** The body of a successful `POST /api/work-type-mapping`: the saved mapping, or `null` for the default. */
export const workTypeMappingResponseSchema = workTypeMappingRequestSchema;

/** The body of a successful `POST /api/abbreviations`: the user's stored abbreviations. */
export const abbreviationsResponseSchema = abbreviationsRequestSchema;
