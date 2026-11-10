import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCORE_LABEL_MAPPING,
  describeDuplicateScoreLabel,
  findDuplicateScoreLabels,
  normalizeScoreLabelMapping,
  resolveItemScores,
  type ScoreLabelMapping,
} from '../score-labels.ts';
import type { ItemScores } from '../scores.ts';

const AT = '2026-11-10T09:00:00.000Z';

describe(resolveItemScores, () => {
  it('takes each dimension from its mapped label when nothing is stored', () => {
    expect(resolveItemScores(undefined, ['urgency:high', 'value:must-have'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      urgency: { score: 'high', by: 'label', label: 'urgency:high' },
      value: { score: 'must-have', by: 'label', label: 'value:must-have' },
    });
  });

  it('keeps a stored score over the label, and fills only the dimension without one', () => {
    const stored: ItemScores = {
      value: { score: 'nice-to-have', by: 'agent', at: AT },
      effort: { score: 3, by: 'author', at: AT },
    };

    expect(resolveItemScores(stored, ['urgency:low', 'value:must-have'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      ...stored,
      urgency: { score: 'low', by: 'label', label: 'urgency:low' },
    });
  });

  it('when labels name two levels of one dimension, takes the higher', () => {
    expect(
      resolveItemScores(undefined, ['value:nice-to-have', 'value:should-have'], DEFAULT_SCORE_LABEL_MAPPING),
    ).toEqual({
      value: { score: 'should-have', by: 'label', label: 'value:should-have' },
    });
  });

  it('matches labels case-insensitively and reports the label as written at the source', () => {
    expect(resolveItemScores(undefined, ['Urgency:Critical'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      urgency: { score: 'critical', by: 'label', label: 'Urgency:Critical' },
    });
  });

  it('ignores an unmapped label', () => {
    expect(resolveItemScores(undefined, ['priority:high', 'bug'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({});
  });

  it('reads labels through the mapping that it is given', () => {
    const mapping: ScoreLabelMapping = {
      ...emptyMapping(),
      urgency: { ...emptyMapping().urgency, high: ['priority:high'] },
    };

    expect(resolveItemScores(undefined, ['priority:high', 'urgency:low'], mapping)).toEqual({
      urgency: { score: 'high', by: 'label', label: 'priority:high' },
    });
    expect(resolveItemScores(undefined, ['urgency:high'], emptyMapping())).toEqual({});
  });
});

describe(findDuplicateScoreLabels, () => {
  it('finds nothing in the default mapping', () => {
    expect(findDuplicateScoreLabels(DEFAULT_SCORE_LABEL_MAPPING)).toEqual([]);
  });

  it('finds a label under two levels of one dimension, case-insensitively', () => {
    const mapping: ScoreLabelMapping = {
      ...emptyMapping(),
      urgency: { ...emptyMapping().urgency, high: ['Hot'], low: ['hot'] },
    };

    expect(findDuplicateScoreLabels(mapping)).toEqual([
      {
        label: 'hot',
        levels: [
          { dimension: 'urgency', level: 'high' },
          { dimension: 'urgency', level: 'low' },
        ],
      },
    ]);
  });

  it('finds a label under one urgency and one value level', () => {
    const mapping: ScoreLabelMapping = {
      urgency: { ...emptyMapping().urgency, critical: ['p0'] },
      value: { ...emptyMapping().value, 'must-have': ['p0'] },
    };

    expect(findDuplicateScoreLabels(mapping)).toEqual([
      {
        label: 'p0',
        levels: [
          { dimension: 'urgency', level: 'critical' },
          { dimension: 'value', level: 'must-have' },
        ],
      },
    ]);
  });
});

describe(describeDuplicateScoreLabel, () => {
  it('names the label, its levels, and the fix', () => {
    expect(
      describeDuplicateScoreLabel({
        label: 'p0',
        levels: [
          { dimension: 'urgency', level: 'critical' },
          { dimension: 'value', level: 'must-have' },
        ],
      }),
    ).toBe('"p0" is under urgency critical and value must-have. Keep it under one level.');
  });
});

describe(normalizeScoreLabelMapping, () => {
  it('trims each label and drops the empty ones', () => {
    const mapping: ScoreLabelMapping = {
      ...emptyMapping(),
      value: { ...emptyMapping().value, questionable: [' maybe ', '', '  '] },
    };

    expect(normalizeScoreLabelMapping(mapping).value.questionable).toEqual(['maybe']);
  });
});

// region | Helpers
function emptyMapping(): ScoreLabelMapping {
  return {
    urgency: { critical: [], high: [], low: [], medium: [] },
    value: { 'must-have': [], 'nice-to-have': [], questionable: [], 'should-have': [] },
  };
}
// endregion | Helpers
