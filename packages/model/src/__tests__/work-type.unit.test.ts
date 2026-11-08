import { describe, expect, it } from 'vitest';

import { classifyWorkType, DEFAULT_WORK_TYPE_MAPPING, MAPPED_WORK_TYPES, type WorkTypeMapping } from '../work-type.ts';

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
