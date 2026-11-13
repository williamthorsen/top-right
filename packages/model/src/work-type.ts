/** A work type that a label mapping can assign. */
export type MappedWorkType = 'bug' | 'feature' | 'ops' | 'task';

/** An item's work type; `none` when none of its labels is mapped. */
export type WorkType = MappedWorkType | 'none';

/** The labels that assign each work type. */
export type WorkTypeMapping = Record<MappedWorkType, readonly string[]>;

/** The name under which each work type is shown. */
export const WORK_TYPE_NAMES: Readonly<Record<WorkType, string>> = {
  bug: 'Bug',
  feature: 'Feature',
  none: 'Unmapped',
  ops: 'Ops',
  task: 'Task',
};

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

/** A label that a mapping assigns to more than one work type. */
export interface DuplicateLabel {
  /** The label, lowercased. */
  label: string;
  /** The work types that list it, in `MAPPED_WORK_TYPES` order. */
  workTypes: MappedWorkType[];
}

/** Returns the message that refuses a label assigned to more than one work type. */
export function describeDuplicateLabel({ label, workTypes }: DuplicateLabel): string {
  const names = workTypes.map((workType) => WORK_TYPE_NAMES[workType]);
  return `"${label}" is in ${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}. Keep it in one type.`;
}

/** Returns each label that `mapping` assigns to more than one work type, compared case-insensitively. */
export function findDuplicateLabels(mapping: WorkTypeMapping): DuplicateLabel[] {
  const typesByLabel = new Map<string, MappedWorkType[]>();
  for (const workType of MAPPED_WORK_TYPES) {
    const labels = new Set(mapping[workType].map((entry) => entry.toLowerCase()));
    for (const label of labels) {
      typesByLabel.set(label, [...(typesByLabel.get(label) ?? []), workType]);
    }
  }
  return [...typesByLabel]
    .filter(([, workTypes]) => workTypes.length > 1)
    .map(([label, workTypes]) => ({ label, workTypes }));
}

/** Returns `mapping` with each label trimmed and each empty label dropped. */
export function normalizeWorkTypeMapping(mapping: WorkTypeMapping): WorkTypeMapping {
  return {
    bug: normalizeLabels(mapping.bug),
    feature: normalizeLabels(mapping.feature),
    ops: normalizeLabels(mapping.ops),
    task: normalizeLabels(mapping.task),
  };
}

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

/**
 * Returns the item label that decides `classifyWorkType`'s result, as the item writes it: the first of `labels` that
 * the winning work type lists. Returns `undefined` when none of the labels is mapped.
 */
export function findWorkTypeLabel(
  labels: readonly string[],
  mapping: WorkTypeMapping = DEFAULT_WORK_TYPE_MAPPING,
): string | undefined {
  for (const workType of MAPPED_WORK_TYPES) {
    const mapped = new Set(mapping[workType].map((label) => label.toLowerCase()));
    const label = labels.find((candidate) => mapped.has(candidate.toLowerCase()));
    if (label !== undefined) return label;
  }
  return undefined;
}

// region | Helpers
function normalizeLabels(labels: readonly string[]): string[] {
  return labels.map((label) => label.trim()).filter((label) => label !== '');
}
// endregion | Helpers
