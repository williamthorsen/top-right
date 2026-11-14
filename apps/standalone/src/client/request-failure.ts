/** The last failed request that the page's alert reports: a read of repositories' issues, or a write of an item. */
export interface Failure {
  kind: 'read' | 'write';
  message: string;
}

/** Returns the updater that drops a failure of `kind`, which the next success of that kind answers. */
export function clearFailureOf(kind: Failure['kind']): (current: Failure | undefined) => Failure | undefined {
  return (current) => (current?.kind === kind ? undefined : current);
}
