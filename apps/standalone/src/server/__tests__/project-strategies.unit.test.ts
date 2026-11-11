import type { GraphqlRequest } from '@top-right/adapter-github';
import { describe, expect, it, vi } from 'vitest';

import { resolveProjectStrategies } from '../project-strategies.ts';
import { StartupError } from '../startup-error.ts';

const URL = 'https://github.com/users/w/projects/3';
const FOUND = {
  data: {
    owner: {
      projectV2: {
        id: 'PVT_3',
        field: {
          __typename: 'ProjectV2SingleSelectField',
          id: 'F_status',
          options: [
            { id: 'O_1', name: 'Todo' },
            { id: 'O_2', name: 'In Progress' },
          ],
        },
      },
    },
  },
};

describe(resolveProjectStrategies, () => {
  it('reads each project once and returns its strategy by URL', async () => {
    const request = vi.fn<GraphqlRequest>(() => Promise.resolve(FOUND));

    const strategies = await resolveProjectStrategies(request, {
      projectOf: { 'w/a': URL, 'w/b': URL },
      projectOptions: {},
    });

    expect(strategies.keys().toArray()).toStrictEqual([URL]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      case: 'the token lacks the scope',
      response: { data: null, errors: [{ type: 'INSUFFICIENT_SCOPES', message: 'requires read:project' }] },
      message: `The GitHub token cannot read ${URL}. Run \`gh auth refresh --scopes project\``,
    },
    {
      case: 'the project is missing or unreadable',
      response: { data: { owner: { projectV2: null } }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }] },
      message:
        'project not found, or the token cannot read it. Check the URL in the config file. If the token cannot read the project: Run `gh auth refresh --scopes project`',
    },
    {
      case: 'the project has no Status field',
      response: { data: { owner: { projectV2: { id: 'PVT_3', field: null } } } },
      message: 'no single-select field named "Status".',
    },
  ])('if $case, throws a StartupError that names the fix', async ({ response, message }) => {
    const result = resolveProjectStrategies(() => Promise.resolve(response), {
      projectOf: { 'w/a': URL },
      projectOptions: {},
    });

    await expect(result).rejects.toThrow(StartupError);
    await expect(result).rejects.toThrow(message);
  });

  it('if the default options are missing, points to the projects entry', async () => {
    const response = {
      data: { owner: { projectV2: { id: 'PVT_3', field: { ...FOUND.data.owner.projectV2.field, options: [] } } } },
    };

    await expect(
      resolveProjectStrategies(() => Promise.resolve(response), { projectOf: { 'w/a': URL }, projectOptions: {} }),
    ).rejects.toThrow(/no option "Todo", "In Progress".*under "projects" in the config file/);
  });

  it('if a listed option is missing, names it without the projects hint', async () => {
    const result = resolveProjectStrategies(() => Promise.resolve(FOUND), {
      projectOf: { 'w/a': URL },
      projectOptions: { [URL]: { toDo: ['Backlog'], inProgress: ['In Progress'] } },
    });

    await expect(result).rejects.toThrow(/no option "Backlog"; its options are Todo, In Progress\.$/);
  });
});
