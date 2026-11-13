import { describe, expect, it } from 'vitest';

import {
  classifyWorkType,
  DEFAULT_WORK_TYPE_MAPPING,
  describeDuplicateLabel,
  findDuplicateLabels,
  findWorkTypeLabel,
  MAPPED_WORK_TYPES,
  normalizeWorkTypeMapping,
  type WorkTypeMapping,
} from '../work-type.ts';

const mappedLabels = MAPPED_WORK_TYPES.flatMap((workType) =>
  DEFAULT_WORK_TYPE_MAPPING[workType].map((label) => ({ label, workType })),
);

describe(classifyWorkType, () => {
  it.each(mappedLabels)('when an item carries "$label", returns $workType', ({ label, workType }) => {
    expect(classifyWorkType([label])).toBe(workType);
  });

  it('matches labels case-insensitively', () => {
    expect(classifyWorkType(['Bug'])).toBe('bug');
  });

  it('if no label is mapped, returns none', () => {
    expect(classifyWorkType(['question', 'help wanted'])).toBe('none');
    expect(classifyWorkType([])).toBe('none');
  });

  it('when labels map to several types, returns the earliest type in classifier order', () => {
    expect(classifyWorkType(['chore', 'bug', 'feature'])).toBe('feature');
  });

  it('when given a mapping, classifies by that mapping', () => {
    const mapping: WorkTypeMapping = { bug: [], feature: [], ops: [], task: ['question'] };
    expect(classifyWorkType(['question'], mapping)).toBe('task');
    expect(classifyWorkType(['bug'], mapping)).toBe('none');
  });
});

describe(findDuplicateLabels, () => {
  it('reports a label that two work types list, compared case-insensitively', () => {
    const mapping: WorkTypeMapping = { bug: ['Fix'], feature: [], ops: [], task: ['fix', 'chore'] };

    expect(findDuplicateLabels(mapping)).toStrictEqual([{ label: 'fix', workTypes: ['bug', 'task'] }]);
  });

  it('reports nothing for the default mapping', () => {
    expect(findDuplicateLabels(DEFAULT_WORK_TYPE_MAPPING)).toStrictEqual([]);
  });

  it('does not count a label that one work type lists twice', () => {
    expect(findDuplicateLabels({ bug: ['bug', 'BUG'], feature: [], ops: [], task: [] })).toStrictEqual([]);
  });
});

describe(describeDuplicateLabel, () => {
  it('names the label, its work types, and the fix', () => {
    expect(describeDuplicateLabel({ label: 'fix', workTypes: ['bug', 'task'] })).toBe(
      '"fix" is in Bug and Task. Keep it in one type.',
    );
  });
});

describe(findWorkTypeLabel, () => {
  it('returns the label that decides the work type, as the item writes it', () => {
    expect(findWorkTypeLabel(['help wanted', 'Bug'])).toBe('Bug');
  });

  it('when labels map to several types, returns the label of the earliest type in classifier order', () => {
    expect(findWorkTypeLabel(['bug', 'feature'])).toBe('feature');
  });

  it('when the winning type lists several of the labels, returns the first in label order', () => {
    const mapping: WorkTypeMapping = { bug: [], feature: ['feature', 'enhancement'], ops: [], task: [] };
    expect(findWorkTypeLabel(['enhancement', 'feature'], mapping)).toBe('enhancement');
  });

  it('if no label is mapped, returns undefined', () => {
    expect(findWorkTypeLabel(['question'])).toBeUndefined();
  });
});

describe(normalizeWorkTypeMapping, () => {
  it('trims each label and drops the empty ones', () => {
    expect(normalizeWorkTypeMapping({ bug: [' bug ', ''], feature: ['  '], ops: [], task: ['chore'] })).toStrictEqual({
      bug: ['bug'],
      feature: [],
      ops: [],
      task: ['chore'],
    });
  });
});
