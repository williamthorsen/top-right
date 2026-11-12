import type { CollectionSettings, ScoreLabelMapping, WorkTypeMapping } from '@top-right/model';
import type { ReactElement, ReactNode } from 'react';

import { AbbreviationsForm } from './AbbreviationsForm.tsx';
import { CollectionsForm } from './CollectionsForm.tsx';
import type { SaveSettings } from './OutcomeMessage.tsx';
import { ScoreLabelMappingForm } from './ScoreLabelMappingForm.tsx';
import { WorkTypeMappingForm } from './WorkTypeMappingForm.tsx';

import './chart.css';

export interface SettingsProps {
  /** The configured repositories, as `owner/name`. */
  repos: readonly string[];
  /** The user's stored abbreviations; a repository without one takes its uppercase first letter. */
  abbreviations: Readonly<Record<string, string>>;
  /** The user's saved mapping; undefined when the user keeps the default. */
  workTypeMapping: WorkTypeMapping | undefined;
  /** The user's saved score-label mapping; undefined when the user keeps the default. */
  scoreLabelMapping: ScoreLabelMapping | undefined;
  /** The user's collections and default collection. */
  collections: CollectionSettings;
  /** Saves each configured repository's abbreviation, an empty string standing for its default. */
  onSaveAbbreviations: SaveSettings<Record<string, string>>;
  /** Saves the mapping, or restores the default when passed undefined. */
  onSaveWorkTypeMapping: SaveSettings<WorkTypeMapping | undefined>;
  /** Saves the score-label mapping, or restores the default when passed undefined. */
  onSaveScoreLabelMapping: SaveSettings<ScoreLabelMapping | undefined>;
  /** Saves the collections and the default collection, replacing the saved ones. */
  onSaveCollections: SaveSettings<CollectionSettings>;
  /** The host's own sections, shown after the forms. */
  children?: ReactNode;
}

/**
 * The Settings page: the labels that assign each work type, the labels that supply each urgency level, value level,
 * and effort, each repository's abbreviation, the collections of repositories, and the host's own sections.
 */
export function Settings({
  repos,
  abbreviations,
  workTypeMapping,
  scoreLabelMapping,
  collections,
  onSaveAbbreviations,
  onSaveCollections,
  onSaveWorkTypeMapping,
  onSaveScoreLabelMapping,
  children,
}: SettingsProps): ReactElement {
  return (
    <div className="tr-root tr-settings">
      <h1>Settings</h1>
      <WorkTypeMappingForm onSave={onSaveWorkTypeMapping} saved={workTypeMapping} />
      <ScoreLabelMappingForm onSave={onSaveScoreLabelMapping} saved={scoreLabelMapping} />
      <AbbreviationsForm abbreviations={abbreviations} onSave={onSaveAbbreviations} repos={repos} />
      <CollectionsForm onSave={onSaveCollections} repos={repos} saved={collections} />
      {children}
    </div>
  );
}
