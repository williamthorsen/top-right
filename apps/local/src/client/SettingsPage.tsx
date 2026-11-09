import { Settings } from '@top-right/chart';
import type { WorkTypeMapping } from '@top-right/model';
import { type ReactElement, useEffect, useState } from 'react';

import {
  abbreviationsResponseSchema,
  type SettingsResponse,
  settingsResponseSchema,
  workTypeMappingResponseSchema,
} from '#src/shared/settings.ts';

import { describeError, getJson, postJson } from './host-requests.ts';

/** The path at which the host serves the Settings page. */
export const SETTINGS_PATH = '/settings';

/** The Settings page, which reads and saves the user's settings through the host and links back to the chart. */
export function SettingsPage(): ReactElement {
  type LoadState =
    { kind: 'error'; message: string } | { kind: 'loaded'; data: SettingsResponse } | { kind: 'loading' };
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      try {
        setState({ kind: 'loaded', data: await getJson('/api/settings', settingsResponseSchema) });
      } catch (error) {
        setState({ kind: 'error', message: describeError(error) });
      }
    })();
  }, []);

  if (state.kind === 'loading') return <p className="host-status">Loading settings</p>;
  if (state.kind === 'error') {
    return (
      <p className="host-status" role="alert">
        Settings did not load: {state.message}
      </p>
    );
  }

  const { data } = state;
  return (
    <Settings
      abbreviations={data.abbreviations}
      chartHref={buildChartHref()}
      onSaveAbbreviations={saveAbbreviations}
      onSaveWorkTypeMapping={saveWorkTypeMapping}
      repos={data.repos}
      workTypeMapping={data.workTypeMapping ?? undefined}
    />
  );
}

// region | Helpers
/** Returns the chart's URL, carrying the item that was selected when the chart linked here. */
function buildChartHref(): string {
  const item = new URLSearchParams(globalThis.location.search).get('item');
  return item === null ? '/' : `/?${new URLSearchParams({ item })}`;
}

/** Runs a save, and returns the reason that it failed as a sentence, or undefined when it succeeded. */
async function refuseOnFailure(save: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await save();
    return undefined;
  } catch (error) {
    const reason = describeError(error);
    return `Not saved: ${reason}${reason.endsWith('.') ? '' : '. Try again.'}`;
  }
}

/** Saves the abbreviations, and returns the reason that the host refused them, if it did. */
async function saveAbbreviations(abbreviations: Record<string, string>): Promise<string | undefined> {
  return await refuseOnFailure(() => postJson('/api/abbreviations', { abbreviations }, abbreviationsResponseSchema));
}

/** Saves the mapping, or restores the default, and returns the reason that the host refused it, if it did. */
async function saveWorkTypeMapping(mapping: WorkTypeMapping | undefined): Promise<string | undefined> {
  return await refuseOnFailure(() =>
    postJson('/api/work-type-mapping', { mapping: mapping ?? null }, workTypeMappingResponseSchema),
  );
}
// endregion | Helpers
