import { Chart } from '@top-right/chart';
import { type ReactElement, useEffect, useState } from 'react';

import { errorResponseSchema, type ItemsResponse, itemsResponseSchema } from '#src/shared/items-response.ts';

/** The page: the chart of the configured repositories' open issues, once they load. */
export function App(): ReactElement {
  type LoadState = { kind: 'error'; message: string } | { kind: 'loaded'; data: ItemsResponse } | { kind: 'loading' };
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      try {
        setState({ kind: 'loaded', data: await loadItems() });
      } catch (error) {
        setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    })();
  }, []);

  if (state.kind === 'loading') return <p className="host-status">Loading issues</p>;
  if (state.kind === 'error') {
    return (
      <p className="host-status" role="alert">
        Issues did not load: {state.message}
      </p>
    );
  }
  return <Chart abbreviations={state.data.abbreviations} items={state.data.items} />;
}

// region | Helpers
async function loadItems(): Promise<ItemsResponse> {
  const response = await fetch('/api/items');
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : `the host responded ${response.status}`);
  }
  return itemsResponseSchema.parse(body);
}
// endregion | Helpers
