import type { UrgencyLevel, ValueLevel } from '@top-right/model';

/** Each urgency and value level's name in the chart's axes, controls, and table. */
export const LEVEL_NAMES: Readonly<Record<UrgencyLevel | ValueLevel, string>> = {
  critical: 'Critical',
  high: 'High',
  low: 'Low',
  medium: 'Medium',
  'must-have': 'Must-have',
  'nice-to-have': 'Nice-to-have',
  questionable: 'Questionable',
  'should-have': 'Should-have',
};
