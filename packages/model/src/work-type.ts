/** A work type that a label mapping can assign. */
export type MappedWorkType = 'bug' | 'feature' | 'ops' | 'task';

/** An item's work type; `none` when none of its labels is mapped. */
export type WorkType = MappedWorkType | 'none';

/** The labels that assign each work type. */
export type WorkTypeMapping = Record<MappedWorkType, readonly string[]>;

/** The work types in the order in which the classifier tries them, which also orders the legend. */
export const MAPPED_WORK_TYPES: readonly MappedWorkType[] = ['feature', 'bug', 'task', 'ops'];

export const DEFAULT_WORK_TYPE_MAPPING: WorkTypeMapping = {
  bug: ['bug', 'defect', 'fix'],
  feature: ['enhancement', 'feat', 'feature'],
  ops: ['admin', 'operations', 'ops'],
  task: [
    'build',
    'chore',
    'ci',
    'deps',
    'docs',
    'documentation',
    'internal',
    'perf',
    'performance',
    'refactor',
    'refactoring',
    'spike',
    'task',
    'test',
    'tests',
    'tooling',
  ],
};

/**
 * Returns the first work type, in `MAPPED_WORK_TYPES` order, whose labels include one of the item's labels. Labels
 * compare case-insensitively, because label case varies across repositories.
 */
export function classifyWorkType(
  labels: readonly string[],
  mapping: WorkTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
): WorkType {
  const itemLabels = new Set(labels.map((label) => label.toLowerCase()));
  for (const workType of MAPPED_WORK_TYPES) {
    if (mapping[workType].some((label) => itemLabels.has(label.toLowerCase()))) return workType;
  }
  return 'none';
}
