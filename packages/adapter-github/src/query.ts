/** The most relations of one kind that the query reads per issue; a personal backlog stays well under it. */
export const RELATION_LIMIT = 50;

/** The most labels that the query reads per issue. */
export const LABEL_LIMIT = 50;

/** Reads one page of a repository's open issues, oldest first, with their labels and relations. */
export const OPEN_ISSUES_QUERY = `
query OpenIssues($owner: String!, $name: String!, $pageSize: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: $pageSize, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        state
        createdAt
        labels(first: ${LABEL_LIMIT}) { nodes { name } }
        blockedBy(first: ${RELATION_LIMIT}) { nodes { ...IssueRef } }
        blocking(first: ${RELATION_LIMIT}) { nodes { ...IssueRef } }
        subIssues(first: ${RELATION_LIMIT}) { nodes { ...IssueRef } }
        parent { ...IssueRef }
      }
    }
  }
}

fragment IssueRef on Issue {
  number
  title
  url
  state
  repository { nameWithOwner }
}
`;
