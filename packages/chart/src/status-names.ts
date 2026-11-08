import type { StatusCategory } from '@top-right/model';

/** Each status's name in the chart's controls and the table. */
export const STATUS_NAMES: Readonly<Record<StatusCategory, string>> = {
  done: 'Done',
  'in-progress': 'In progress',
  'to-do': 'To do',
};
