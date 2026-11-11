import type { GraphqlRequest } from '#src/fetch-issues.ts';

interface Mutation {
  id: string;
  add?: string[];
  remove?: string[];
}

/**
 * Returns a fake GraphQL endpoint holding one issue, `owner/repo#7`, whose repository has the labels of `repoLabels`
 * (name to id), and the mutations that it receives.
 */
export function createFakeGithub(repoLabels: Record<string, string>, initial: string[], mutationError?: string) {
  let issueLabels = [...initial];
  const mutations: Mutation[] = [];
  const idOf = (name: string): string => repoLabels[name.toLowerCase()] ?? `L_${name}`;

  const request: GraphqlRequest = (query, variables) => {
    if (query.startsWith('query')) {
      const lookups = Object.fromEntries(
        Object.entries(variables)
          .filter(([key]) => key.startsWith('add'))
          .map(([key, name]) => {
            const id = typeof name === 'string' ? repoLabels[name] : undefined;
            return [key, id === undefined ? null : { id, name }];
          }),
      );
      const labels = issueLabels.map((name) => ({ id: idOf(name), name }));
      return Promise.resolve({ data: { repository: { issue: { id: 'I_7', labels: { nodes: labels } }, ...lookups } } });
    }
    if (mutationError !== undefined) return Promise.resolve({ data: null, errors: [{ message: mutationError }] });
    const mutation = parseMutation(variables);
    mutations.push(mutation);
    const added = Object.entries(repoLabels)
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

/** Reads the issue id and the label ids to add and remove from a mutation's variables. */
function parseMutation(variables: Record<string, unknown>): Mutation {
  const { id, add, remove } = variables;
  return {
    id: String(id),
    ...(Array.isArray(add) && { add: add.map(String) }),
    ...(Array.isArray(remove) && { remove: remove.map(String) }),
  };
}
