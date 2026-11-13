import {
  EFFORT_SCALE,
  type EffortPoints,
  type ItemScores,
  type LabelScoreEntry,
  type ResolvedItemScores,
  type ScoreEntry,
  type ScoreField,
  type ScoreTypes,
  URGENCY_LEVELS,
  type UrgencyLevel,
  VALUE_LEVELS,
  type ValueLevel,
} from './scores.ts';

/** A dimension whose score a label can supply. */
export type LabelDimension = 'effort' | 'urgency' | 'value';

/** The labels that supply each urgency level, each value level, and each effort on the scale. */
export interface ScoreLabelMapping {
  urgency: Readonly<Record<UrgencyLevel, readonly string[]>>;
  value: Readonly<Record<ValueLevel, readonly string[]>>;
  effort: Readonly<Record<EffortPoints, readonly string[]>>;
}

/** The default mapping: Each entry takes the label `<dimension>:<entry>`. */
export const DEFAULT_SCORE_LABEL_MAPPING: ScoreLabelMapping = {
  urgency: {
    critical: ['urgency:critical'],
    high: ['urgency:high'],
    low: ['urgency:low'],
    medium: ['urgency:medium'],
  },
  value: {
    'must-have': ['value:must-have'],
    'nice-to-have': ['value:nice-to-have'],
    questionable: ['value:questionable'],
    'should-have': ['value:should-have'],
  },
  effort: {
    1: ['effort:1'],
    2: ['effort:2'],
    3: ['effort:3'],
    5: ['effort:5'],
    8: ['effort:8'],
    13: ['effort:13'],
  },
};

/** A label that a mapping lists under more than one entry. */
export interface DuplicateScoreLabel {
  /** The label, lowercased. */
  label: string;
  /** The entries that list it, in the order urgency, value, effort, and each dimension in descending rank. */
  levels: ReadonlyArray<{ dimension: LabelDimension; level: EffortPoints | UrgencyLevel | ValueLevel }>;
}

/** Returns the message that refuses a label listed under more than one entry. */
export function describeDuplicateScoreLabel({ label, levels }: DuplicateScoreLabel): string {
  const names = levels.map(({ dimension, level }) => `${dimension} ${level}`);
  return `"${label}" is under ${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}. Keep it under one level.`;
}

/**
 * Returns each label that `mapping` lists under more than one entry, in any dimension, compared case-insensitively.
 */
export function findDuplicateScoreLabels(mapping: ScoreLabelMapping): DuplicateScoreLabel[] {
  const levelsByLabel = new Map<string, DuplicateScoreLabel['levels']>();
  for (const { dimension, level, labels } of listLevelLabels(mapping)) {
    const lowercased = new Set(labels.map((entry) => entry.toLowerCase()));
    for (const label of lowercased) {
      levelsByLabel.set(label, [...(levelsByLabel.get(label) ?? []), { dimension, level }]);
    }
  }
  return [...levelsByLabel].filter(([, levels]) => levels.length > 1).map(([label, levels]) => ({ label, levels }));
}

/** Returns `mapping` with each label trimmed and each empty label dropped. */
export function normalizeScoreLabelMapping(mapping: ScoreLabelMapping): ScoreLabelMapping {
  return {
    urgency: {
      critical: normalizeLabels(mapping.urgency.critical),
      high: normalizeLabels(mapping.urgency.high),
      low: normalizeLabels(mapping.urgency.low),
      medium: normalizeLabels(mapping.urgency.medium),
    },
    value: {
      'must-have': normalizeLabels(mapping.value['must-have']),
      'nice-to-have': normalizeLabels(mapping.value['nice-to-have']),
      questionable: normalizeLabels(mapping.value.questionable),
      'should-have': normalizeLabels(mapping.value['should-have']),
    },
    effort: {
      1: normalizeLabels(mapping.effort[1]),
      2: normalizeLabels(mapping.effort[2]),
      3: normalizeLabels(mapping.effort[3]),
      5: normalizeLabels(mapping.effort[5]),
      8: normalizeLabels(mapping.effort[8]),
      13: normalizeLabels(mapping.effort[13]),
    },
  };
}

/** The levels that a label write sets, by dimension; an absent dimension keeps its labels, and `null` clears them. */
export interface LabelLevels {
  urgency?: UrgencyLevel | null | undefined;
  value?: ValueLevel | null | undefined;
  effort?: number | null | undefined;
}

/** The labels that a write adds and removes, or the reason that the mapping refuses it. */
export type LabelChangePlan =
  { kind: 'change'; add: string[]; remove: string[] } | { kind: 'refused'; message: string };

/**
 * Returns the label change that sets `levels`: For each dimension, the first label that the mapping lists for the level
 * is added, and every label listed under the dimension's other levels is removed. A `null` dimension removes every label
 * listed under it and adds none. A level for which the mapping lists no label refuses the write.
 */
export function planLabelChange(levels: LabelLevels, mapping: ScoreLabelMapping): LabelChangePlan {
  const add: string[] = [];
  const remove: string[] = [];
  const effort =
    levels.effort === undefined || levels.effort === null
      ? levels.effort
      : EFFORT_SCALE.find((points) => points === levels.effort);
  if (levels.effort !== undefined && effort === undefined) {
    return { kind: 'refused', message: `effort ${levels.effort} is not on the scale` };
  }
  const families = [
    planFamily('urgency', URGENCY_LEVELS, mapping.urgency, levels.urgency),
    planFamily('value', VALUE_LEVELS, mapping.value, levels.value),
    planFamily('effort', EFFORT_SCALE, mapping.effort, effort),
  ];
  for (const family of families) {
    if (family === undefined) continue;
    if (family.kind === 'refused') return family;
    add.push(...family.add);
    remove.push(...family.remove);
  }
  return { kind: 'change', add, remove };
}

/** Returns `labels` without each label that `mapping` lists under `dimensions`, compared case-insensitively. */
export function removeDimensionLabels(
  labels: readonly string[],
  dimensions: readonly LabelDimension[],
  mapping: ScoreLabelMapping,
): string[] {
  const mapped = new Set(
    listLevelLabels(mapping)
      .filter(({ dimension }) => dimensions.includes(dimension))
      .flatMap((entry) => entry.labels.map((label) => label.toLowerCase())),
  );
  return labels.filter((label) => !mapped.has(label.toLowerCase()));
}

/**
 * Returns an item's stored scores with, for urgency, value, and effort where none is stored, the score of the highest
 * entry whose labels include one of the item's labels. Labels compare case-insensitively. A label's level is the score
 * that the author holds, so an agent entry without a previous score takes the label's level as its previous one.
 */
export function resolveItemScores(
  stored: ItemScores | undefined,
  labels: readonly string[],
  mapping: ScoreLabelMapping,
): ResolvedItemScores {
  const urgency = resolveEntry(stored?.urgency, findLabelScore(URGENCY_LEVELS, mapping.urgency, labels));
  const value = resolveEntry(stored?.value, findLabelScore(VALUE_LEVELS, mapping.value, labels));
  const effort = resolveEntry(stored?.effort, findLabelScore(EFFORT_SCALE, mapping.effort, labels));
  return {
    ...stored,
    ...(urgency && { urgency }),
    ...(value && { value }),
    ...(effort && { effort }),
  };
}

// region | Helpers
/** Returns the entry of the highest of `levels` (given in ascending rank) whose labels include one of `labels`. */
function findLabelScore<T extends EffortPoints | UrgencyLevel | ValueLevel>(
  levels: readonly T[],
  levelLabels: Readonly<Record<T, readonly string[]>>,
  labels: readonly string[],
): LabelScoreEntry<T> | undefined {
  for (const level of levels.toReversed()) {
    const mapped = new Set(levelLabels[level].map((label) => label.toLowerCase()));
    const label = labels.find((candidate) => mapped.has(candidate.toLowerCase()));
    if (label !== undefined) return { score: level, by: 'label', label };
  }
  return undefined;
}

/** Returns each entry with its labels, in the order urgency, value, effort, and each dimension in descending rank. */
function listLevelLabels(mapping: ScoreLabelMapping): LevelLabels[] {
  return [
    ...listDimensionLabels('urgency', URGENCY_LEVELS, mapping.urgency),
    ...listDimensionLabels('value', VALUE_LEVELS, mapping.value),
    ...listDimensionLabels('effort', EFFORT_SCALE, mapping.effort),
  ];
}

/** Returns one dimension's entries, given in ascending rank, with their labels in descending rank. */
function listDimensionLabels<T extends EffortPoints | UrgencyLevel | ValueLevel>(
  dimension: LabelDimension,
  levels: readonly T[],
  levelLabels: Readonly<Record<T, readonly string[]>>,
): LevelLabels[] {
  return levels.toReversed().map((level) => ({ dimension, level, labels: levelLabels[level] }));
}

interface LevelLabels {
  dimension: LabelDimension;
  level: EffortPoints | UrgencyLevel | ValueLevel;
  labels: readonly string[];
}

function normalizeLabels(labels: readonly string[]): string[] {
  return labels.map((label) => label.trim()).filter((label) => label !== '');
}

/**
 * Returns the change that sets one dimension to `level`, or that clears it when `level` is `null`, or `undefined` when
 * `level` is absent.
 */
function planFamily<T extends EffortPoints | UrgencyLevel | ValueLevel>(
  dimension: LabelDimension,
  levels: readonly T[],
  levelLabels: Readonly<Record<T, readonly string[]>>,
  level: T | null | undefined,
): LabelChangePlan | undefined {
  if (level === undefined) return undefined;
  if (level === null) return { kind: 'change', add: [], remove: levels.flatMap((other) => levelLabels[other]) };
  const [label] = levelLabels[level];
  if (label === undefined) {
    return { kind: 'refused', message: `no label is mapped to ${dimension} ${level}; add one in Settings` };
  }
  const remove = levels.filter((other) => other !== level).flatMap((other) => levelLabels[other]);
  return { kind: 'change', add: [label], remove };
}

/**
 * Returns the stored entry, or the label score when none is stored. An agent entry without a previous score takes the
 * label's level as its previous one.
 */
function resolveEntry<T extends ScoreTypes[ScoreField], L extends T & (EffortPoints | UrgencyLevel | ValueLevel)>(
  stored: ScoreEntry<T> | undefined,
  label: LabelScoreEntry<L> | undefined,
): LabelScoreEntry<L> | ScoreEntry<T> | undefined {
  if (!stored) return label;
  if (stored.by !== 'agent' || stored.previous !== undefined || !label) return stored;
  return { ...stored, previous: label.score };
}
// endregion | Helpers
