import { z } from 'zod';

import { GitHubAdapterError, type GraphqlRequest } from './fetch-issues.ts';

/** The labels to add to an issue and the labels to remove from it, by name. */
export interface LabelChange {
  add: readonly string[];
  remove: readonly string[];
}

/** The most labels that a label write reads per issue. */
const ISSUE_LABEL_LIMIT = 100;

const labelSchema = z.object({ id: z.string(), name: z.string() });

const labelsSchema = z.object({ nodes: z.array(z.object({ name: z.string() })) });

const errorsSchema = z.array(z.object({ message: z.string() })).optional();

/** The response to the read query; each label lookup is an extra field of the repository, parsed separately. */
const readResponseSchema = z.object({
  data: z
    .object({
      repository: z
        .looseObject({
          issue: z.object({ id: z.string(), labels: z.object({ nodes: z.array(labelSchema) }) }).nullable(),
        })
        .nullable(),
    })
    .nullish(),
  errors: errorsSchema,
});

/**
 * Adds and removes labels on issue `number` of `repo` (`owner/name`), and resolves to the issue's resulting labels.
 * Names compare case-insensitively: A label that the issue already has is not added, and one that it lacks is not
 * removed. A label to add that the repository lacks rejects the whole write, because the adapter never creates one.
 */
export async function updateIssueLabels(
  request: GraphqlRequest,
  repo: string,
  number: number,
  change: LabelChange,
): Promise<string[]> {
  const [owner, name, extra] = repo.split('/', 3);
  if (!owner || !name || extra !== undefined) {
    throw new GitHubAdapterError(`${repo}: expected a repository as owner/name`);
  }
  const issue = await readIssueLabels(request, repo, { owner, name, number, add: change.add });
  const carried = new Map(issue.labels.map((label) => [label.name.toLowerCase(), label]));
  const removing = new Set(change.remove.map((label) => label.toLowerCase()));
  const addIds = issue.labelsToAdd.filter((label) => !carried.has(label.name.toLowerCase())).map((label) => label.id);
  const removeIds = issue.labels.filter((label) => removing.has(label.name.toLowerCase())).map((label) => label.id);
  if (addIds.length === 0 && removeIds.length === 0) return issue.labels.map((label) => label.name);
  return writeLabels(request, `${repo}#${number}`, issue.id, addIds, removeIds);
}

// region | Helpers
interface IssueLabels {
  id: string;
  labels: Array<z.infer<typeof labelSchema>>;
  /** The repository's labels for each name to add, in the order given. */
  labelsToAdd: Array<z.infer<typeof labelSchema>>;
}

/** Returns the GraphQL query that reads an issue's labels and the repository's label for each of `addCount` names. */
function buildReadQuery(addCount: number): string {
  const indexes = Array.from({ length: addCount }, (_, index) => index);
  const variables = indexes.map((index) => `, $add${index}: String!`).join('');
  const lookups = indexes.map((index) => `add${index}: label(name: $add${index}) { id name }`).join('\n    ');
  return `query IssueLabels($owner: String!, $name: String!, $number: Int!${variables}) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id labels(first: ${ISSUE_LABEL_LIMIT}) { nodes { id name } } }
    ${lookups}
  }
}`;
}

/** Returns the GraphQL mutation that adds and removes labels, each field only when it has labels to change. */
function buildWriteMutation(isAdding: boolean, isRemoving: boolean): string {
  const result = `labelable { labels(first: ${ISSUE_LABEL_LIMIT}) { nodes { name } } }`;
  const fields = [
    isAdding && `added: addLabelsToLabelable(input: { labelableId: $id, labelIds: $add }) { ${result} }`,
    isRemoving && `removed: removeLabelsFromLabelable(input: { labelableId: $id, labelIds: $remove }) { ${result} }`,
  ].filter((field) => field !== false);
  const variables = [isAdding && '$add: [ID!]!', isRemoving && '$remove: [ID!]!'].filter((field) => field !== false);
  return `mutation UpdateLabels($id: ID!, ${variables.join(', ')}) {\n  ${fields.join('\n  ')}\n}`;
}

function describeErrors(errors: ReadonlyArray<{ message: string }>): string {
  return errors.map((error) => error.message).join('; ');
}

/** Reads the issue's id and labels, and the id of each label to add, throwing when the repository lacks one. */
async function readIssueLabels(
  request: GraphqlRequest,
  repo: string,
  variables: { owner: string; name: string; number: number; add: readonly string[] },
): Promise<IssueLabels> {
  const { add, ...rest } = variables;
  const key = `${repo}#${variables.number}`;
  const lookupVariables: Record<string, string> = {};
  for (const [index, label] of add.entries()) lookupVariables[`add${index}`] = label;
  const aliases = Object.keys(lookupVariables);
  const parsed = readResponseSchema.safeParse(
    await request(buildReadQuery(add.length), { ...rest, ...lookupVariables }),
  );
  if (!parsed.success) throw new GitHubAdapterError(`${key}: unexpected response from GitHub`, { cause: parsed.error });
  const { data, errors } = parsed.data;
  if (errors?.length) throw new GitHubAdapterError(`${key}: ${describeErrors(errors)}`);
  const repository = data?.repository;
  if (!repository) throw new GitHubAdapterError(`${repo}: repository not found, or the token cannot read it`);
  if (!repository.issue) throw new GitHubAdapterError(`${key}: issue not found`);
  const lookups = z
    .object(Object.fromEntries(aliases.map((alias) => [alias, labelSchema.nullable()])))
    .safeParse(repository);
  if (!lookups.success)
    throw new GitHubAdapterError(`${key}: unexpected response from GitHub`, { cause: lookups.error });
  const labelsToAdd = add.map((label, index) => {
    const found = lookups.data[`add${index}`];
    if (!found) throw new GitHubAdapterError(`${repo} has no label "${label}". Create it at GitHub, then try again.`);
    return found;
  });
  return { id: repository.issue.id, labels: repository.issue.labels.nodes, labelsToAdd };
}

/** Adds and removes labels by id, and returns the issue's labels after the write. */
async function writeLabels(
  request: GraphqlRequest,
  key: string,
  id: string,
  add: readonly string[],
  remove: readonly string[],
): Promise<string[]> {
  const isAdding = add.length > 0;
  const isRemoving = remove.length > 0;
  const payloadSchema = z.object({ labelable: z.object({ labels: labelsSchema }) }).nullable();
  const schema = z.object({
    data: z.object({ added: payloadSchema.optional(), removed: payloadSchema.optional() }).nullish(),
    errors: errorsSchema,
  });
  const parsed = schema.safeParse(
    await request(buildWriteMutation(isAdding, isRemoving), {
      id,
      ...(isAdding && { add }),
      ...(isRemoving && { remove }),
    }),
  );
  if (!parsed.success) throw new GitHubAdapterError(`${key}: unexpected response from GitHub`, { cause: parsed.error });
  const { data, errors } = parsed.data;
  if (errors?.length)
    throw new GitHubAdapterError(`${key}: GitHub refused the label change: ${describeErrors(errors)}`);
  // The removal runs after the addition, so its payload holds the labels after both.
  const result = data?.removed ?? data?.added;
  if (!result) throw new GitHubAdapterError(`${key}: GitHub returned no labels after the change`);
  return result.labelable.labels.nodes.map((label) => label.name);
}
// endregion | Helpers
