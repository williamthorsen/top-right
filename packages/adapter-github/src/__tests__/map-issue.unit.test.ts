import { describe, expect, it } from 'vitest';

import { mapIssue, openIssuesResponseSchema } from '../map-issue.ts';
import pageOne from './fixtures/open-issues.page-1.json' with { type: 'json' };

const REPO = 'williamthorsen/top-right';

describe(mapIssue, () => {
  it('maps an issue with its labels and every kind of relation', () => {
    const issue = findIssue(12);

    expect(mapIssue(issue, REPO)).toMatchObject({
      repo: REPO,
      number: 12,
      url: `https://github.com/${REPO}/issues/12`,
      state: 'open',
      labels: ['feature'],
      relations: [
        { kind: 'blocked-by', ref: { repo: REPO, number: 11, state: 'open' } },
        { kind: 'blocking', ref: { repo: REPO, number: 13 } },
        { kind: 'parent', ref: { repo: REPO, number: 10 } },
      ],
    });
  });

  it('lists sub-issues as relations of their parent', () => {
    const subIssueNumbers = mapIssue(findIssue(10), REPO)
      .relations.filter((relation) => relation.kind === 'sub-issue')
      .map((relation) => relation.ref.number);

    expect(subIssueNumbers).toStrictEqual([11, 12, 13, 14, 15, 16]);
  });

  it('keeps the repository of a related issue', () => {
    const issue = findIssue(12);
    if (!issue.parent) throw new Error('fixture #12 lacks a parent');
    const elsewhere = { ...issue.parent, repository: { nameWithOwner: 'williamthorsen/other' } };

    const item = mapIssue({ ...issue, parent: elsewhere }, REPO);

    expect(item.relations.find((relation) => relation.kind === 'parent')?.ref.repo).toBe('williamthorsen/other');
  });
});

// region | Helpers
function findIssue(number: number) {
  const issue = openIssuesResponseSchema
    .parse(pageOne)
    .data?.repository?.issues.nodes.find((node) => node.number === number);
  if (!issue) throw new Error(`fixture lacks #${number}`);
  return issue;
}
// endregion | Helpers
