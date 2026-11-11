import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { createLabelStatusStrategy, IN_PROGRESS_LABEL } from '../status-strategy.ts';
import { createFakeGithub } from '../test-utils/fake-github.ts';

const REF = { repo: 'owner/repo', number: 7 };
const REPO_LABELS: Record<string, string> = { bug: 'L_bug', [IN_PROGRESS_LABEL]: 'L_in_progress' };

describe(createLabelStatusStrategy, () => {
  describe('read', () => {
    it('returns in-progress for an item with the label in any case', () => {
      const strategy = createLabelStatusStrategy(createFakeGithub(REPO_LABELS, []).request);

      expect(strategy.read(buildItem(['bug', 'Status:In-Progress']))).toBe('in-progress');
    });

    it('returns to-do for an item without the label', () => {
      const strategy = createLabelStatusStrategy(createFakeGithub(REPO_LABELS, []).request);

      expect(strategy.read(buildItem(['bug', 'status:blocked']))).toBe('to-do');
    });
  });

  describe('write', () => {
    it('adds the label for in-progress and resolves to the resulting labels and status', async () => {
      const github = createFakeGithub(REPO_LABELS, ['bug']);

      const patch = await createLabelStatusStrategy(github.request).write(REF, 'in-progress');

      expect(github.mutations).toEqual([{ id: 'I_7', add: ['L_in_progress'] }]);
      expect(patch).toEqual({ labels: ['bug', IN_PROGRESS_LABEL], sourceStatus: 'in-progress' });
    });

    it('removes the label in any case for to-do and resolves to the resulting labels and status', async () => {
      const github = createFakeGithub(REPO_LABELS, ['bug', 'Status:In-Progress']);

      const patch = await createLabelStatusStrategy(github.request).write(REF, 'to-do');

      expect(github.mutations).toEqual([{ id: 'I_7', remove: ['L_in_progress'] }]);
      expect(patch).toEqual({ labels: ['bug'], sourceStatus: 'to-do' });
    });

    it('if the repository lacks the label, rejects naming it and writes nothing', async () => {
      const github = createFakeGithub({ bug: 'L_bug' }, ['bug']);

      await expect(createLabelStatusStrategy(github.request).write(REF, 'in-progress')).rejects.toThrow(
        /no label "status:in-progress"; create it at GitHub/,
      );
      expect(github.mutations).toEqual([]);
    });
  });
});

// region | Helpers
/** Returns an open work item, `owner/repo#7`, with the labels given. */
function buildItem(labels: string[]): WorkItem {
  return {
    ...REF,
    title: 'An issue',
    url: 'https://github.com/owner/repo/issues/7',
    state: 'open',
    createdAt: '2026-11-01T00:00:00.000Z',
    labels,
    relations: [],
  };
}
// endregion | Helpers
