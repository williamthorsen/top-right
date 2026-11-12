import { DEFAULT_SCORE_LABEL_MAPPING } from '@top-right/model';
import { z } from 'zod';

/** The name of each setting in the `settings` table, whose `value` holds the setting as JSON. */
export const ABBREVIATIONS_SETTING = 'abbreviations';
export const COLLECTIONS_SETTING = 'collections';
export const SCORE_LABEL_MAPPING_SETTING = 'score-label-mapping';
export const WORK_TYPE_MAPPING_SETTING = 'work-type-mapping';

export const abbreviationsSchema = z.record(z.string(), z.string());

/** Stored collection settings; JSON omits an undefined default, so an absent one reads as undefined. */
export const collectionSettingsSchema = z.object({
  collections: z.array(z.object({ id: z.string(), name: z.string(), repos: z.array(z.string()) })),
  defaultCollectionId: z.string().optional(),
});

const labelsSchema = z.array(z.string());

/** A stored score-label mapping; one without effort entries reads with the default effort labels. */
export const scoreLabelMappingSchema = z
  .object({
    urgency: z.object({ critical: labelsSchema, high: labelsSchema, low: labelsSchema, medium: labelsSchema }),
    value: z.object({
      'must-have': labelsSchema,
      'nice-to-have': labelsSchema,
      questionable: labelsSchema,
      'should-have': labelsSchema,
    }),
    effort: z
      .object({ 1: labelsSchema, 2: labelsSchema, 3: labelsSchema, 5: labelsSchema, 8: labelsSchema, 13: labelsSchema })
      .optional(),
  })
  .transform(({ effort, ...mapping }) => ({ ...mapping, effort: effort ?? DEFAULT_SCORE_LABEL_MAPPING.effort }));

export const workTypeMappingSchema = z.object({
  bug: labelsSchema,
  feature: labelsSchema,
  ops: labelsSchema,
  task: labelsSchema,
});
