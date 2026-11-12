import { Settings } from '@top-right/chart';
import type { ScoreLabelMapping, WorkTypeMapping } from '@top-right/model';
import { type ReactElement, useEffect, useState } from 'react';

import {
  abbreviationsResponseSchema,
  scoreLabelMappingResponseSchema,
  type SettingsResponse,
  settingsResponseSchema,
  workTypeMappingResponseSchema,
} from '#src/shared/settings.ts';

import { AppHeader } from './AppHeader.tsx';
import { describeError, getJson, postJson } from './host-requests.ts';
import { buildChartHref, buildSettingsHref, readUrlItem } from './page-hrefs.ts';
import { RepositoriesSection } from './RepositoriesSection.tsx';

/** The Settings page, which reads and saves the user's settings through the host and lists the repositories. */
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

  const item = readUrlItem();
  const header = (
    <AppHeader chartHref={buildChartHref(item)} current="settings" settingsHref={buildSettingsHref(item)} />
  );
  if (state.kind === 'loading') {
    return (
      <>
        {header}
        <p className="host-status">Loading settings</p>
      </>
    );
  }
  if (state.kind === 'error') {
    return (
      <>
        {header}
        <p className="host-status" role="alert">
          Settings did not load: {state.message}
        </p>
      </>
    );
  }

  const { data } = state;
  return (
    <>
      {header}
      <Settings
        abbreviations={data.abbreviations}
        onSaveAbbreviations={saveAbbreviations}
        onSaveScoreLabelMapping={saveScoreLabelMapping}
        onSaveWorkTypeMapping={saveWorkTypeMapping}
        repos={data.repos}
        scoreLabelMapping={data.scoreLabelMapping ?? undefined}
        workTypeMapping={data.workTypeMapping ?? undefined}
      >
        <RepositoriesSection configPath={data.configPath} repos={data.repos} />
      </Settings>
    </>
  );
}

// region | Helpers
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

/**
 * Saves the score-label mapping, or restores the default, and returns the reason that the host refused it, if it
 * did.
 */
async function saveScoreLabelMapping(mapping: ScoreLabelMapping | undefined): Promise<string | undefined> {
  return await refuseOnFailure(() =>
    postJson('/api/score-label-mapping', { mapping: mapping ?? null }, scoreLabelMappingResponseSchema),
  );
}

/** Saves the mapping, or restores the default, and returns the reason that the host refused it, if it did. */
async function saveWorkTypeMapping(mapping: WorkTypeMapping | undefined): Promise<string | undefined> {
  return await refuseOnFailure(() =>
    postJson('/api/work-type-mapping', { mapping: mapping ?? null }, workTypeMappingResponseSchema),
  );
}
// endregion | Helpers
