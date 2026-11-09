/** The most relations of one kind that the query reads per issue; a personal backlog stays well under it. */
export const RELATION_LIMIT = 50;

/** The most labels that the query reads per issue. */
export const LABEL_LIMIT = 50;

/** Reads one page of a repository's issues in the given states, order, and filter, with their labels and relations. */
export const ISSUES_QUERY = `
query Issues(
  $owner: String!
  $name: String!
  $states: [IssueState!]!
  $orderBy: IssueOrder!
  $filterBy: IssueFilters
  $pageSize: Int!
  $after: String
) {
  repository(owner: $owner, name: $name) {
    issues(states: $states, orderBy: $orderBy, filterBy: $filterBy, first: $pageSize, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        state
        createdAt
        closedAt
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
