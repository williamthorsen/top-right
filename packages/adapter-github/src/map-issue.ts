import type { ItemRef, Relation, RelationKind, WorkItem } from '@top-right/model';
import { z } from 'zod';

const issueRefSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(['CLOSED', 'OPEN']),
  repository: z.object({ nameWithOwner: z.string() }),
});

const issueSchema = issueRefSchema.omit({ repository: true }).extend({
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  blockedBy: z.object({ nodes: z.array(issueRefSchema) }),
  blocking: z.object({ nodes: z.array(issueRefSchema) }),
  subIssues: z.object({ nodes: z.array(issueRefSchema) }),
  parent: issueRefSchema.nullable(),
});

/** The response to one page of `OPEN_ISSUES_QUERY`. */
export const openIssuesResponseSchema = z.object({
  data: z
    .object({
      repository: z
        .object({
          issues: z.object({
            pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
            nodes: z.array(issueSchema),
          }),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export type GitHubIssue = z.infer<typeof issueSchema>;

/** Maps an issue of `repo` (`owner/name`) to a work item. */
export function mapIssue(issue: GitHubIssue, repo: string): WorkItem {
  return {
    ...mapRef({ ...issue, repository: { nameWithOwner: repo } }),
    labels: issue.labels.nodes.map((label) => label.name),
    relations: [
      ...mapRelations('blocked-by', issue.blockedBy.nodes),
      ...mapRelations('blocking', issue.blocking.nodes),
      ...mapRelations('parent', issue.parent ? [issue.parent] : []),
      ...mapRelations('sub-issue', issue.subIssues.nodes),
    ],
  };
}

// region | Helpers
function mapRef(ref: z.infer<typeof issueRefSchema>): ItemRef {
  return {
    repo: ref.repository.nameWithOwner,
    number: ref.number,
    title: ref.title,
    url: ref.url,
    state: ref.state === 'OPEN' ? 'open' : 'closed',
  };
}

function mapRelations(kind: RelationKind, refs: Array<z.infer<typeof issueRefSchema>>): Relation[] {
  return refs.map((ref) => ({ kind, ref: mapRef(ref) }));
}
// endregion | Helpers
