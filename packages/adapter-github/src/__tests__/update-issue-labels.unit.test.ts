import { describe, expect, it } from 'vitest';

import { GitHubAdapterError } from '../fetch-issues.ts';
import { createFakeGithub } from '../test-utils/fake-github.ts';
import { updateIssueLabels } from '../update-issue-labels.ts';

const REPO_LABELS: Record<string, string> = {
  bug: 'L_bug',
  'urgency:high': 'L_high',
  'urgency:low': 'L_low',
  'value:must-have': 'L_must',
};

describe(updateIssueLabels, () => {
  it('adds the labels that the issue lacks, removes the ones that it carries, and returns the result', async () => {
    const github = createFakeGithub(REPO_LABELS, ['bug', 'Urgency:Low']);

    const labels = await updateIssueLabels(github.request, 'owner/repo', 7, {
      add: ['urgency:high', 'value:must-have'],
      remove: ['urgency:low', 'urgency:medium'],
    });

    expect(github.mutations).toEqual([{ id: 'I_7', add: ['L_high', 'L_must'], remove: ['L_low'] }]);
    expect(labels).toEqual(['bug', 'urgency:high', 'value:must-have']);
  });

  it('if the issue already carries every label to add and none to remove, writes nothing', async () => {
    const github = createFakeGithub(REPO_LABELS, ['bug', 'URGENCY:HIGH']);

    const labels = await updateIssueLabels(github.request, 'owner/repo', 7, {
      add: ['urgency:high'],
      remove: ['urgency:low'],
    });

    expect(github.mutations).toEqual([]);
    expect(labels).toEqual(['bug', 'URGENCY:HIGH']);
  });

  it('if the repository lacks a label to add, rejects naming the label and writes nothing', async () => {
    const github = createFakeGithub(REPO_LABELS, []);

    await expect(updateIssueLabels(github.request, 'owner/repo', 7, { add: ['effort:5'], remove: [] })).rejects.toThrow(
      /no label "effort:5"/,
    );
    expect(github.mutations).toEqual([]);
  });

  it('if GitHub refuses the mutation, rejects with its message', async () => {
    const github = createFakeGithub(REPO_LABELS, ['urgency:low'], 'Resource not accessible by integration');

    const write = updateIssueLabels(github.request, 'owner/repo', 7, { add: ['urgency:high'], remove: [] });

    await expect(write).rejects.toThrow(GitHubAdapterError);
    await expect(write).rejects.toThrow(/Resource not accessible/);
  });
});
