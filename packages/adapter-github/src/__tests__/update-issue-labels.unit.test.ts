import { describe, expect, it } from 'vitest';

import { GitHubAdapterError, type GraphqlRequest } from '../fetch-issues.ts';
import { updateIssueLabels } from '../update-issue-labels.ts';

const REPO_LABELS: Record<string, string> = {
  bug: 'L_bug',
  'urgency:high': 'L_high',
  'urgency:low': 'L_low',
  'value:must-have': 'L_must',
};

describe(updateIssueLabels, () => {
  it('adds the labels that the issue lacks, removes the ones that it carries, and returns the result', async () => {
    const github = createFakeGithub(['bug', 'Urgency:Low']);

    const labels = await updateIssueLabels(github.request, 'owner/repo', 7, {
      add: ['urgency:high', 'value:must-have'],
      remove: ['urgency:low', 'urgency:medium'],
    });

    expect(github.mutations).toEqual([{ id: 'I_7', add: ['L_high', 'L_must'], remove: ['L_low'] }]);
    expect(labels).toEqual(['bug', 'urgency:high', 'value:must-have']);
  });

  it('if the issue already carries every label to add and none to remove, writes nothing', async () => {
    const github = createFakeGithub(['bug', 'URGENCY:HIGH']);

    const labels = await updateIssueLabels(github.request, 'owner/repo', 7, {
      add: ['urgency:high'],
      remove: ['urgency:low'],
    });

    expect(github.mutations).toEqual([]);
    expect(labels).toEqual(['bug', 'URGENCY:HIGH']);
  });

  it('if the repository lacks a label to add, rejects naming the label and writes nothing', async () => {
    const github = createFakeGithub([]);

    await expect(updateIssueLabels(github.request, 'owner/repo', 7, { add: ['effort:5'], remove: [] })).rejects.toThrow(
      /no label "effort:5"/,
    );
    expect(github.mutations).toEqual([]);
  });

  it('if GitHub refuses the mutation, rejects with its message', async () => {
    const github = createFakeGithub(['urgency:low'], 'Resource not accessible by integration');

    const write = updateIssueLabels(github.request, 'owner/repo', 7, { add: ['urgency:high'], remove: [] });

    await expect(write).rejects.toThrow(GitHubAdapterError);
    await expect(write).rejects.toThrow(/Resource not accessible/);
  });
});

// region | Helpers
interface Mutation {
  id: string;
  add?: string[];
  remove?: string[];
}

/** Returns a fake GraphQL endpoint holding one issue, `owner/repo#7`, and the mutations that it receives. */
function createFakeGithub(initial: string[], mutationError?: string) {
  let issueLabels = [...initial];
  const mutations: Mutation[] = [];
  const idOf = (name: string): string => REPO_LABELS[name.toLowerCase()] ?? `L_${name}`;

  const request: GraphqlRequest = (query, variables) => {
    if (query.startsWith('query')) {
      const lookups = Object.fromEntries(
        Object.entries(variables)
          .filter(([key]) => key.startsWith('add'))
          .map(([key, name]) => {
            const id = typeof name === 'string' ? REPO_LABELS[name] : undefined;
            return [key, id === undefined ? null : { id, name }];
          }),
      );
      const labels = issueLabels.map((name) => ({ id: idOf(name), name }));
      return Promise.resolve({ data: { repository: { issue: { id: 'I_7', labels: { nodes: labels } }, ...lookups } } });
    }
    if (mutationError !== undefined) return Promise.resolve({ data: null, errors: [{ message: mutationError }] });
    const mutation = parseMutation(variables);
    mutations.push(mutation);
    const added = Object.entries(REPO_LABELS)
      .filter(([, id]) => mutation.add?.includes(id))
      .map(([name]) => name);
    issueLabels = [...issueLabels, ...added].filter((name) => !mutation.remove?.includes(idOf(name)));
    const payload = { labelable: { labels: { nodes: issueLabels.map((name) => ({ name })) } } };
    return Promise.resolve({
      data: { ...(mutation.add && { added: payload }), ...(mutation.remove && { removed: payload }) },
    });
  };
  return { mutations, request };
}

function parseMutation(variables: Record<string, unknown>): Mutation {
  const { id, add, remove } = variables;
  return {
    id: String(id),
    ...(Array.isArray(add) && { add: add.map(String) }),
    ...(Array.isArray(remove) && { remove: remove.map(String) }),
  };
}
// endregion | Helpers
