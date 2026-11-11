import type { GraphqlRequest } from '#src/fetch-issues.ts';

/** How the fake answers a request that it would otherwise serve. */
type Failure = 'mutation-refused' | 'no-field' | 'no-project' | 'scope';

interface FakeProjectOptions {
  failure?: Failure;
  /** The Status options, by name. */
  options?: string[];
  /** The issues that are already items, by number, with their option's name. */
  items?: Record<number, string>;
}

interface FakeGithubProject {
  /** The option name of each item after the requests, by issue number. */
  items: Map<number, string | undefined>;
  /** The operations received, by name, in order. */
  operations: string[];
  request: GraphqlRequest;
}

/** The id of the fake's project. */
export const FAKE_PROJECT_ID = 'PVT_1';

/** The URL of the fake's project. */
export const FAKE_PROJECT_URL = 'https://github.com/users/owner/projects/3';

/**
 * Returns a fake GraphQL endpoint holding project 3 of user `owner`, whose Status field has `options`, and the issues
 * of `owner/repo`, whose node ids are `I_<number>`.
 */
export function createFakeGithubProject({
  failure,
  options = ['Todo', 'In Progress', 'Done'],
  items: initial = {},
}: FakeProjectOptions = {}): FakeGithubProject {
  const items = new Map<number, string | undefined>(
    Object.entries(initial).map(([number, name]) => [Number(number), name]),
  );
  const operations: string[] = [];
  const optionIds = Object.fromEntries(options.map((name, index) => [`O_${index}`, name]));

  const request: GraphqlRequest = (query, variables) => {
    const operation = /^(?:query|mutation) (\w+)/.exec(query)?.[1] ?? 'unknown';
    operations.push(operation);
    if (failure === 'scope') {
      return Promise.resolve({
        data: null,
        errors: [{ type: 'INSUFFICIENT_SCOPES', message: "The 'projectV2' field requires one of: ['read:project']" }],
      });
    }
    if (operation === 'Project') return Promise.resolve(answerProject(variables));
    if (operation === 'IssueId') {
      return Promise.resolve({ data: { repository: { issue: { id: `I_${String(variables['number'])}` } } } });
    }
    if (failure === 'mutation-refused') {
      return Promise.resolve({ data: null, errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible' }] });
    }
    const number = Number(String(variables['contentId'] ?? variables['itemId']).replace(/^\D+_/, ''));
    if (operation === 'AddItem') {
      if (!items.has(number)) items.set(number, undefined);
      return Promise.resolve({ data: { addProjectV2ItemById: { item: { id: `PVTI_${number}` } } } });
    }
    items.set(number, optionIds[String(variables['optionId'])]);
    return Promise.resolve({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: `PVTI_${number}` } } } });
  };
  return { items, operations, request };

  function answerProject(variables: Record<string, unknown>): unknown {
    if (failure === 'no-project' || variables['login'] !== 'owner' || variables['number'] !== 3) {
      return {
        data: { owner: { projectV2: null } },
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a ProjectV2 with the number 3.' }],
      };
    }
    const field =
      failure === 'no-field'
        ? null
        : {
            __typename: 'ProjectV2SingleSelectField',
            id: 'F_status',
            options: Object.entries(optionIds).map(([id, name]) => ({ id, name })),
          };
    return { data: { owner: { projectV2: { id: FAKE_PROJECT_ID, field } } } };
  }
}
