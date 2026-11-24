import type { WorkItem } from '@top-right/model';
import { describe, expect, it } from 'vitest';

import { GitHubAdapterError, GitHubScopeError } from '../fetch-issues.ts';
import { createIssueStatusStrategy } from '../issue-status.ts';
import { createFakeIssueStatus, DEFAULT_PLANNING_STATUSES } from '../test-utils/fake-issue-status.ts';

const ITEM: WorkItem = {
  repo: 'owner/repo',
  number: 7,
  title: 'An issue',
  url: 'https://github.com/owner/repo/issues/7',
  state: 'open',
  createdAt: '2026-11-01T00:00:00Z',
  labels: [],
  relations: [],
};

const REF = { repo: 'owner/repo', number: 7 };

describe(createIssueStatusStrategy, () => {
  const { request } = createFakeIssueStatus();
  const strategy = createIssueStatusStrategy(request);

  it.each([
    { key: 'started', status: 'in-progress' },
    { key: 'planned', status: 'to-do' },
    { key: 'triage', status: 'to-do' },
  ])('reads an issue in the $key category as $status, and shows it', ({ key, status }) => {
    const issue = { status: { category: { key } } };

    expect(strategy.read(ITEM, issue)).toStrictEqual({ sourceStatus: status });
    expect(strategy.hides?.(ITEM, issue)).toBe(false);
  });

  it.each([
    { case: 'in the backlog category', issue: { status: { category: { key: 'backlog' } } } },
    { case: 'without a status', issue: { status: null } },
  ])('hides an issue $case', ({ issue }) => {
    expect(strategy.hides?.(ITEM, issue)).toBe(true);
  });

  it('if the status is malformed, throws naming the item', () => {
    expect(() => strategy.read(ITEM, { status: { name: 'Todo' } })).toThrow(/^owner\/repo#7: unexpected response/);
  });

  it.each([
    { status: 'in-progress' as const, id: 'IS_in_progress' },
    { status: 'to-do' as const, id: 'IS_todo' },
  ])('writes $status as the first status of its category', async ({ status, id }) => {
    const fake = createFakeIssueStatus();

    const patch = await createIssueStatusStrategy(fake.request).write(REF, status);

    expect(patch).toStrictEqual({ sourceStatus: status });
    expect(fake.set.get(7)).toBe(id);
  });

  it.each([
    {
      case: 'issue statuses are unavailable',
      statuses: null,
      message: /^owner\/repo: issue statuses are not available/,
    },
    {
      case: 'no status has the target category',
      statuses: DEFAULT_PLANNING_STATUSES.filter(({ key }) => key !== 'planned'),
      message: /^owner\/repo: the repository has no issue status in the "planned" category/,
    },
  ])('if $case, refuses the write naming the repository', async ({ statuses, message }) => {
    const fake = createFakeIssueStatus({ statuses });

    const result = createIssueStatusStrategy(fake.request).write(REF, 'to-do');

    await expect(result).rejects.toThrow(GitHubAdapterError);
    await expect(result).rejects.toThrow(message);
    expect(fake.set.size).toBe(0);
  });

  it('if GitHub refuses the mutation, rejects naming the issue', async () => {
    const fake = createFakeIssueStatus({ failure: 'mutation-refused' });

    await expect(createIssueStatusStrategy(fake.request).write(REF, 'in-progress')).rejects.toThrow(
      /^owner\/repo#7: GitHub refused the request: Resource not accessible/,
    );
  });

  it('if the token lacks the scope, rejects with a scope error that names issue statuses', async () => {
    const fake = createFakeIssueStatus({ failure: 'scope' });

    const result = createIssueStatusStrategy(fake.request).write(REF, 'in-progress');

    await expect(result).rejects.toThrow(GitHubScopeError);
    await expect(result).rejects.toThrow(/the scope that issue statuses need/);
  });
});
