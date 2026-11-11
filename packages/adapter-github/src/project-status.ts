import type { OpenStatus, WorkItem } from '@top-right/model';
import { z } from 'zod';

import { GitHubAdapterError, GitHubNotFoundError, GitHubScopeError, type GraphqlRequest } from './fetch-issues.ts';
import { PROJECT_ITEM_LIMIT } from './query.ts';
import type { StatusStrategy } from './status-strategy.ts';

/** The options of a project's Status field that read as each open status; the first of each list is the one written. */
export interface ProjectStatusOptions {
  inProgress: readonly string[];
  toDo: readonly string[];
}

/** A project as its URL names it. */
export interface ProjectRef {
  login: string;
  number: number;
  ownerKind: 'organization' | 'user';
  /** The URL in canonical form. */
  url: string;
}

/** A project read from GitHub, with its Status field. */
export interface ResolvedProject {
  id: string;
  statusField: { id: string; options: ReadonlyArray<{ id: string; name: string }> };
  url: string;
}

/** The option names of the Status field of a project that GitHub creates. */
export const DEFAULT_PROJECT_STATUS_OPTIONS: ProjectStatusOptions = { toDo: ['Todo'], inProgress: ['In Progress'] };

/** The name of the single-select field that holds an item's status. */
const STATUS_FIELD_NAME = 'Status';

const PROJECT_URL_PATTERN = /^https:\/\/github\.com\/(users|orgs)\/([\w-]+)\/projects\/(\d+)(?:\/views\/\d+)?\/?$/i;

/**
 * Returns the status strategy that reads an open item's status from the project's Status field and writes it there,
 * adding the issue to the project when it is not yet an item. Throws when the field lacks a listed option.
 */
export function createProjectStatusStrategy(
  request: GraphqlRequest,
  project: ResolvedProject,
  options: ProjectStatusOptions = DEFAULT_PROJECT_STATUS_OPTIONS,
): StatusStrategy {
  const optionIdOf = new Map(project.statusField.options.map((option) => [option.name.toLowerCase(), option.id]));
  const missing = [...options.toDo, ...options.inProgress].filter((name) => !optionIdOf.has(name.toLowerCase()));
  if (missing.length > 0) {
    const names = project.statusField.options.map((option) => option.name).join(', ');
    throw new GitHubAdapterError(
      `${project.url}: the ${STATUS_FIELD_NAME} field has no option ${missing.map((name) => `"${name}"`).join(', ')}; its options are ${names}`,
    );
  }
  const inProgress = new Set(options.inProgress.map((name) => name.toLowerCase()));
  const target: Record<OpenStatus, string | undefined> = {
    'in-progress': optionIdOf.get(options.inProgress[0]?.toLowerCase() ?? ''),
    'to-do': optionIdOf.get(options.toDo[0]?.toLowerCase() ?? ''),
  };

  return {
    issueFields: `projectItems(first: ${PROJECT_ITEM_LIMIT}, includeArchived: false) {
          nodes {
            project { id }
            fieldValueByName(name: "${STATUS_FIELD_NAME}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
          }
        }`,
    read(item, issue) {
      const name = readOptionName(item, issue, project.id);
      return name !== undefined && inProgress.has(name.toLowerCase()) ? 'in-progress' : 'to-do';
    },
    async write(ref, status) {
      const key = `${ref.repo}#${ref.number}`;
      const optionId = target[status];
      if (optionId === undefined) throw new GitHubAdapterError(`${project.url}: no option is listed for ${status}`);
      const contentId = await readIssueId(request, ref.repo, ref.number);
      const added = await sendStrictRequest(
        request,
        key,
        ADD_ITEM_MUTATION,
        { projectId: project.id, contentId },
        z.object({ addProjectV2ItemById: z.object({ item: z.object({ id: z.string() }) }) }),
      );
      await sendStrictRequest(
        request,
        key,
        SET_STATUS_MUTATION,
        {
          projectId: project.id,
          itemId: added.addProjectV2ItemById.item.id,
          fieldId: project.statusField.id,
          optionId,
        },
        z.object({ updateProjectV2ItemFieldValue: z.object({ projectV2Item: z.object({ id: z.string() }) }) }),
      );
      return { sourceStatus: status };
    },
  };
}

/** Returns the project that `url` names, or undefined when it is not a project URL. */
export function parseProjectUrl(url: string): ProjectRef | undefined {
  const match = PROJECT_URL_PATTERN.exec(url.trim());
  if (!match) return undefined;
  const [, segment = '', login = '', number = ''] = match;
  const ownerSegment = segment.toLowerCase() === 'orgs' ? 'orgs' : 'users';
  const canonicalLogin = login.toLowerCase();
  return {
    login: canonicalLogin,
    number: Number(number),
    ownerKind: ownerSegment === 'orgs' ? 'organization' : 'user',
    url: `https://github.com/${ownerSegment}/${canonicalLogin}/projects/${Number(number)}`,
  };
}

/**
 * Reads the project that `url` names, with its Status field. Throws a `GitHubScopeError` when the token lacks the scope
 * to read projects, a `GitHubNotFoundError` when the project is missing or unreadable, and a `GitHubAdapterError` when
 * its single-select Status field is missing.
 */
export async function resolveProject(request: GraphqlRequest, url: string): Promise<ResolvedProject> {
  const ref = parseProjectUrl(url);
  if (!ref)
    throw new GitHubAdapterError(`${url}: expected a project URL, such as https://github.com/users/LOGIN/projects/1`);
  const fieldSchema = z
    .union([
      z.object({
        __typename: z.literal('ProjectV2SingleSelectField'),
        id: z.string(),
        options: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
      z.object({ __typename: z.string() }),
    ])
    .nullable();
  const { data, errors } = await sendRequest(
    request,
    ref.url,
    buildProjectQuery(ref.ownerKind),
    { login: ref.login, number: ref.number },
    z.object({
      owner: z.object({ projectV2: z.object({ id: z.string(), field: fieldSchema }).nullable() }).nullable(),
    }),
  );
  // A missing owner or project arrives as a NOT_FOUND error beside null data; the message below names it.
  const refused = errors.filter((error) => error.type !== 'NOT_FOUND');
  if (refused.length > 0)
    throw new GitHubAdapterError(`${ref.url}: GitHub refused the request: ${describeErrors(refused)}`);
  const projectV2 = data?.owner?.projectV2;
  if (!projectV2) throw new GitHubNotFoundError(`${ref.url}: project not found, or the token cannot read it`);
  const { field } = projectV2;
  if (!field || !('options' in field)) {
    throw new GitHubAdapterError(`${ref.url}: the project has no single-select field named "${STATUS_FIELD_NAME}"`);
  }
  return { id: projectV2.id, statusField: { id: field.id, options: field.options }, url: ref.url };
}

// region | Helpers
const ADD_ITEM_MUTATION = `mutation AddItem($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
}`;

const SET_STATUS_MUTATION = `mutation SetStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }
  ) { projectV2Item { id } }
}`;

const ISSUE_ID_QUERY = `query IssueId($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) { issue(number: $number) { id } }
}`;

const projectItemsSchema = z.object({
  projectItems: z.object({
    nodes: z.array(
      z.object({
        project: z.object({ id: z.string() }),
        fieldValueByName: z.object({ name: z.string().optional() }).nullable(),
      }),
    ),
  }),
});

/** Returns the query that reads a user's or an organization's project, by number, with its Status field. */
function buildProjectQuery(ownerKind: ProjectRef['ownerKind']): string {
  return `query Project($login: String!, $number: Int!) {
  owner: ${ownerKind}(login: $login) {
    projectV2(number: $number) {
      id
      field(name: "${STATUS_FIELD_NAME}") { __typename ... on ProjectV2SingleSelectField { id options { id name } } }
    }
  }
}`;
}

/** Joins the messages of GraphQL errors into one line. */
function describeErrors(errors: ReadonlyArray<{ message: string }>): string {
  return errors.map((error) => error.message).join('; ');
}

/** Reads the node id of issue `number` of `repo` (`owner/name`). */
async function readIssueId(request: GraphqlRequest, repo: string, number: number): Promise<string> {
  const [owner, name] = repo.split('/', 2);
  const key = `${repo}#${number}`;
  const data = await sendStrictRequest(
    request,
    key,
    ISSUE_ID_QUERY,
    { owner, name, number },
    z.object({ repository: z.object({ issue: z.object({ id: z.string() }).nullable() }).nullable() }),
  );
  const id = data.repository?.issue?.id;
  if (id === undefined) throw new GitHubAdapterError(`${key}: issue not found`);
  return id;
}

/** Returns the name of the item's option in the project's Status field, or undefined when it has none. */
function readOptionName(item: WorkItem, issue: unknown, projectId: string): string | undefined {
  const parsed = projectItemsSchema.safeParse(issue);
  if (!parsed.success) {
    throw new GitHubAdapterError(`${item.repo}#${item.number}: unexpected response from GitHub`, {
      cause: parsed.error,
    });
  }
  return parsed.data.projectItems.nodes.find((node) => node.project.id === projectId)?.fieldValueByName?.name;
}

/**
 * Sends a query or a mutation and returns its parsed data and errors. Rejects, naming `key`, on a malformed response,
 * and with a `GitHubScopeError` when the token lacks a scope that the request needs.
 */
async function sendRequest<T extends z.ZodType>(
  request: GraphqlRequest,
  key: string,
  query: string,
  variables: Record<string, unknown>,
  dataSchema: T,
): Promise<{ data: z.output<T> | undefined; errors: Array<{ message: string; type?: string | undefined }> }> {
  const schema = z.object({
    data: dataSchema.nullish(),
    errors: z.array(z.object({ message: z.string(), type: z.string().optional() })).optional(),
  });
  const parsed = schema.safeParse(await request(query, variables));
  if (!parsed.success) throw new GitHubAdapterError(`${key}: unexpected response from GitHub`, { cause: parsed.error });
  const { data, errors = [] } = parsed.data;
  if (errors.some((error) => error.type === 'INSUFFICIENT_SCOPES')) {
    throw new GitHubScopeError(`${key}: the token lacks the scope that projects need`);
  }
  return { data: data ?? undefined, errors };
}

/** Sends a query or a mutation as `sendRequest` does, and also rejects on any error or on a response without data. */
async function sendStrictRequest<T extends z.ZodType>(
  request: GraphqlRequest,
  key: string,
  query: string,
  variables: Record<string, unknown>,
  dataSchema: T,
): Promise<z.output<T>> {
  const { data, errors } = await sendRequest(request, key, query, variables, dataSchema);
  if (errors.length > 0) throw new GitHubAdapterError(`${key}: GitHub refused the request: ${describeErrors(errors)}`);
  if (data === undefined) throw new GitHubAdapterError(`${key}: GitHub returned no data`);
  return data;
}
// endregion | Helpers
