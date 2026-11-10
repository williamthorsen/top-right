import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCORE_LABEL_MAPPING,
  describeDuplicateScoreLabel,
  findDuplicateScoreLabels,
  normalizeScoreLabelMapping,
  planLabelChange,
  resolveItemScores,
  type ScoreLabelMapping,
} from '../score-labels.ts';
import type { ItemScores } from '../scores.ts';

const AT = '2026-11-10T09:00:00.000Z';

describe(planLabelChange, () => {
  it("adds the level's label and removes the labels of the dimension's other levels", () => {
    expect(planLabelChange({ urgency: 'high' }, DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      kind: 'change',
      add: ['urgency:high'],
      remove: ['urgency:low', 'urgency:medium', 'urgency:critical'],
    });
  });

  it('when several dimensions are set, plans each and leaves an absent one alone', () => {
    const plan = planLabelChange({ value: 'must-have', effort: 5 }, DEFAULT_SCORE_LABEL_MAPPING);

    expect(plan).toEqual({
      kind: 'change',
      add: ['value:must-have', 'effort:5'],
      remove: [
        'value:questionable',
        'value:nice-to-have',
        'value:should-have',
        'effort:1',
        'effort:2',
        'effort:3',
        'effort:8',
        'effort:13',
      ],
    });
  });

  it('adds the first label that the mapping lists for the level, and removes every other listed one', () => {
    const mapping: ScoreLabelMapping = {
      ...emptyMapping(),
      urgency: { ...emptyMapping().urgency, high: ['p1', 'hot'], low: ['p3'] },
    };

    expect(planLabelChange({ urgency: 'high' }, mapping)).toEqual({ kind: 'change', add: ['p1'], remove: ['p3'] });
  });

  it('if the mapping lists no label for a level, refuses the write and points to Settings', () => {
    const plan = planLabelChange({ urgency: 'high', value: 'must-have' }, emptyMapping());

    expect(plan).toEqual({ kind: 'refused', message: expect.stringContaining('urgency high') });
    expect(plan.kind === 'refused' && plan.message).toContain('Settings');
  });

  it('if the effort is not on the scale, refuses the write', () => {
    expect(planLabelChange({ effort: 4 }, DEFAULT_SCORE_LABEL_MAPPING)).toMatchObject({ kind: 'refused' });
  });
});

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

  it('takes the effort from its mapped label when none is stored, and the larger of two', () => {
    expect(resolveItemScores(undefined, ['effort:5'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      effort: { score: 5, by: 'label', label: 'effort:5' },
    });
    expect(resolveItemScores(undefined, ['effort:8', 'Effort:3'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({
      effort: { score: 8, by: 'label', label: 'effort:8' },
    });
  });

  it('keeps a stored effort over the label', () => {
    const stored: ItemScores = { effort: { score: 2, by: 'author', at: AT } };

    expect(resolveItemScores(stored, ['effort:13'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual(stored);
  });

  it('ignores an unmapped label', () => {
    expect(resolveItemScores(undefined, ['priority:high', 'bug', 'effort:4'], DEFAULT_SCORE_LABEL_MAPPING)).toEqual({});
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
      ...emptyMapping(),
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

  it('finds a label under an effort and a value level', () => {
    const mapping: ScoreLabelMapping = {
      ...emptyMapping(),
      value: { ...emptyMapping().value, 'must-have': ['big'] },
      effort: { ...emptyMapping().effort, 13: ['Big'] },
    };

    expect(findDuplicateScoreLabels(mapping)).toEqual([
      {
        label: 'big',
        levels: [
          { dimension: 'value', level: 'must-have' },
          { dimension: 'effort', level: 13 },
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
      effort: { ...emptyMapping().effort, 3: [' medium ', ''] },
    };

    expect(normalizeScoreLabelMapping(mapping).value.questionable).toEqual(['maybe']);
    expect(normalizeScoreLabelMapping(mapping).effort[3]).toEqual(['medium']);
  });
});

// region | Helpers
function emptyMapping(): ScoreLabelMapping {
  return {
    urgency: { critical: [], high: [], low: [], medium: [] },
    value: { 'must-have': [], 'nice-to-have': [], questionable: [], 'should-have': [] },
    effort: { 1: [], 2: [], 3: [], 5: [], 8: [], 13: [] },
  };
}
// endregion | Helpers
