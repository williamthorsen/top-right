import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { GitHubAdapterError, GitHubNotFoundError, GitHubScopeError } from '../fetch-issues.ts';
import {
  createProjectStatusStrategy,
  parseProjectUrl,
  type ResolvedProject,
  resolveProject,
} from '../project-status.ts';
import { createFakeGithubProject, FAKE_PROJECT_ID, FAKE_PROJECT_URL } from '../test-utils/fake-github-project.ts';

const REF = { repo: 'owner/repo', number: 7 };
const ITEM: WorkItem = {
  ...REF,
  title: 'An issue',
  url: 'https://github.com/owner/repo/issues/7',
  state: 'open',
  createdAt: '2026-11-01T00:00:00.000Z',
  labels: [],
  relations: [],
};

describe(parseProjectUrl, () => {
  it.each([
    ['https://github.com/users/Owner/projects/3', 'https://github.com/users/owner/projects/3', 'user'],
    ['https://github.com/orgs/acme/projects/12/', 'https://github.com/orgs/acme/projects/12', 'organization'],
    ['https://github.com/users/owner/projects/3/views/2', 'https://github.com/users/owner/projects/3', 'user'],
  ])('reads %s as %s', (url, canonical, ownerKind) => {
    expect(parseProjectUrl(url)).toMatchObject({ url: canonical, ownerKind });
  });

  it.each(['https://github.com/owner/repo', 'https://example.com/users/owner/projects/3', 'owner/3'])(
    'returns undefined for %s',
    (url) => {
      expect(parseProjectUrl(url)).toBeUndefined();
    },
  );
});

describe(resolveProject, () => {
  it('returns the project with its Status field', async () => {
    const { request } = createFakeGithubProject({ options: ['Todo', 'Done'] });

    const project = await resolveProject(request, 'https://github.com/users/Owner/projects/3/');

    expect(project).toStrictEqual({
      id: FAKE_PROJECT_ID,
      statusField: {
        id: 'F_status',
        options: [
          { id: 'O_0', name: 'Todo' },
          { id: 'O_1', name: 'Done' },
        ],
      },
      url: FAKE_PROJECT_URL,
    });
  });

  it('if the token lacks the scope, rejects with a scope error', async () => {
    const { request } = createFakeGithubProject({ failure: 'scope' });

    await expect(resolveProject(request, FAKE_PROJECT_URL)).rejects.toThrow(GitHubScopeError);
  });

  it('if the project is missing or unreadable, rejects with a not-found error', async () => {
    const { request } = createFakeGithubProject({ failure: 'no-project' });

    await expect(resolveProject(request, FAKE_PROJECT_URL)).rejects.toThrow(GitHubNotFoundError);
  });

  it.each([
    { failure: 'no-project' as const, message: 'project not found, or the token cannot read it' },
    { failure: 'no-field' as const, message: 'the project has no single-select field named "Status"' },
  ])('if $failure, rejects naming the project', async ({ failure, message }) => {
    const { request } = createFakeGithubProject({ failure });

    const result = resolveProject(request, FAKE_PROJECT_URL);

    await expect(result).rejects.toThrow(`${FAKE_PROJECT_URL}: ${message}`);
    await expect(result).rejects.not.toThrow(GitHubScopeError);
  });

  it('rejects a URL that is not a project URL without sending a request', async () => {
    const github = createFakeGithubProject();

    await expect(resolveProject(github.request, 'https://github.com/owner/repo')).rejects.toThrow(GitHubAdapterError);
    expect(github.operations).toStrictEqual([]);
  });
});

describe(createProjectStatusStrategy, () => {
  it('if the field lacks a listed option, throws naming it and the options that exist', async () => {
    const project = await resolveFakeProject();

    expect(() =>
      createProjectStatusStrategy(createFakeGithubProject().request, project, {
        toDo: ['Backlog'],
        inProgress: ['in progress'],
      }),
    ).toThrow(/no option "Backlog"; its options are Todo, In Progress, Done/);
  });

  describe('read', () => {
    it.each([
      { case: 'an In progress option, in any case', issue: buildIssue('in PROGRESS'), status: 'in-progress' },
      { case: 'a To do option', issue: buildIssue('Todo'), status: 'to-do' },
      { case: 'Done on an open issue', issue: buildIssue('Done'), status: 'to-do' },
      { case: 'no Status', issue: buildIssue(undefined), status: 'to-do' },
      { case: 'an item of another project only', issue: buildIssue('In Progress', 'PVT_other'), status: 'to-do' },
      { case: 'no item in the project', issue: { projectItems: { nodes: [] } }, status: 'to-do' },
    ])('reads $case as $status', async ({ issue, status }) => {
      const strategy = createProjectStatusStrategy(createFakeGithubProject().request, await resolveFakeProject());

      expect(strategy.read(ITEM, issue)).toBe(status);
    });

    it('reads the options that the lists name', async () => {
      const github = createFakeGithubProject({ options: ['Backlog', 'Doing', 'Review'] });
      const strategy = createProjectStatusStrategy(
        github.request,
        await resolveProject(github.request, FAKE_PROJECT_URL),
        {
          toDo: ['Backlog'],
          inProgress: ['Doing', 'Review'],
        },
      );

      expect(strategy.read(ITEM, buildIssue('Review'))).toBe('in-progress');
    });

    it('asks the issues query for the Status of each project item', async () => {
      const strategy = createProjectStatusStrategy(createFakeGithubProject().request, await resolveFakeProject());

      expect(strategy.issueFields).toMatch(/projectItems\(first: 20, includeArchived: false\)/);
      expect(strategy.issueFields).toMatch(/fieldValueByName\(name: "Status"\)/);
    });
  });

  describe('write', () => {
    it('sets the option of an issue that is already an item, and resolves to the status', async () => {
      const github = createFakeGithubProject({ items: { 7: 'Todo' } });
      const strategy = createProjectStatusStrategy(
        github.request,
        await resolveProject(github.request, FAKE_PROJECT_URL),
      );

      const patch = await strategy.write(REF, 'in-progress');

      expect(patch).toStrictEqual({ sourceStatus: 'in-progress' });
      expect(github.items.get(7)).toBe('In Progress');
    });

    it('adds an issue that is not yet an item before it sets the option', async () => {
      const github = createFakeGithubProject();
      const strategy = createProjectStatusStrategy(
        github.request,
        await resolveProject(github.request, FAKE_PROJECT_URL),
      );

      await strategy.write(REF, 'to-do');

      expect(github.operations).toStrictEqual(['Project', 'IssueId', 'AddItem', 'SetStatus']);
      expect(github.items.get(7)).toBe('Todo');
    });

    it('writes the first option of the target list', async () => {
      const github = createFakeGithubProject({ options: ['Backlog', 'Doing', 'Review'] });
      const strategy = createProjectStatusStrategy(
        github.request,
        await resolveProject(github.request, FAKE_PROJECT_URL),
        {
          toDo: ['Backlog'],
          inProgress: ['doing', 'Review'],
        },
      );

      await strategy.write(REF, 'in-progress');

      expect(github.items.get(7)).toBe('Doing');
    });

    it("if GitHub refuses the write, rejects with GitHub's message", async () => {
      const github = createFakeGithubProject({ failure: 'mutation-refused' });
      const strategy = createProjectStatusStrategy(github.request, await resolveFakeProject());

      await expect(strategy.write(REF, 'in-progress')).rejects.toThrow(
        'owner/repo#7: GitHub refused the request: Resource not accessible',
      );
      expect(github.items.size).toBe(0);
    });
  });
});

// region | Helpers
/** Returns an issue as the query returns it, with one item in `projectId` whose Status option is `name`. */
function buildIssue(name: string | undefined, projectId = FAKE_PROJECT_ID): unknown {
  return {
    projectItems: {
      nodes: [{ project: { id: projectId }, fieldValueByName: name === undefined ? null : { name } }],
    },
  };
}

/** Returns the fake's project with the default options. */
function resolveFakeProject(): Promise<ResolvedProject> {
  return resolveProject(createFakeGithubProject().request, FAKE_PROJECT_URL);
}
// endregion | Helpers
