import {
  abbreviate,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  describeAbbreviationClash,
  describeDuplicateLabel,
  describeDuplicateScoreLabel,
  describeInvalidAbbreviation,
  findAbbreviationClashes,
  findDuplicateLabels,
  findDuplicateScoreLabels,
  isValidAbbreviation,
  MAPPED_WORK_TYPES,
  type MappedWorkType,
  normalizeScoreLabelMapping,
  normalizeWorkTypeMapping,
  resolveAbbreviations,
  type ScoreLabelMapping,
  URGENCY_LEVELS,
  type UrgencyLevel,
  VALUE_LEVELS,
  type ValueLevel,
  WORK_TYPE_NAMES,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { LEVEL_NAMES } from './level-names.ts';

import './chart.css';

/** Reports the outcome of a save: the host's refusal message, or undefined when the save succeeded. */
export type SaveSettings<T> = (value: T) => Promise<string | undefined>;

export interface SettingsProps {
  /** The configured repositories, as `owner/name`. */
  repos: readonly string[];
  /** The user's stored abbreviations; a repository without one takes its first letter. */
  abbreviations: Readonly<Record<string, string>>;
  /** The user's saved mapping; undefined when the user keeps the default. */
  workTypeMapping: WorkTypeMapping | undefined;
  /** The user's saved score-label mapping; undefined when the user keeps the default. */
  scoreLabelMapping: ScoreLabelMapping | undefined;
  /** Where the chart is. */
  chartHref: string;
  /** Saves each configured repository's abbreviation, an empty string standing for its default. */
  onSaveAbbreviations: SaveSettings<Record<string, string>>;
  /** Saves the mapping, or restores the default when passed undefined. */
  onSaveWorkTypeMapping: SaveSettings<WorkTypeMapping | undefined>;
  /** Saves the score-label mapping, or restores the default when passed undefined. */
  onSaveScoreLabelMapping: SaveSettings<ScoreLabelMapping | undefined>;
}

/**
 * The Settings page: the labels that assign each work type, the labels that supply each urgency and value level, and
 * each repository's abbreviation.
 */
export function Settings({
  repos,
  abbreviations,
  workTypeMapping,
  scoreLabelMapping,
  chartHref,
  onSaveAbbreviations,
  onSaveWorkTypeMapping,
  onSaveScoreLabelMapping,
}: SettingsProps): ReactElement {
  return (
    <div className="tr-root tr-settings">
      <header className="tr-settings-header">
        <h1>Settings</h1>
        <a href={chartHref}>Chart</a>
      </header>
      <WorkTypeMappingForm onSave={onSaveWorkTypeMapping} saved={workTypeMapping} />
      <ScoreLabelMappingForm onSave={onSaveScoreLabelMapping} saved={scoreLabelMapping} />
      <AbbreviationsForm abbreviations={abbreviations} onSave={onSaveAbbreviations} repos={repos} />
    </div>
  );
}

// region | Helpers
type Outcome = { kind: 'error'; message: string } | { kind: 'saved' } | undefined;

/** The repository abbreviations, refused while invalid or shared by two repositories. */
function AbbreviationsForm({
  repos,
  abbreviations,
  onSave,
}: {
  repos: readonly string[];
  abbreviations: Readonly<Record<string, string>>;
  onSave: SaveSettings<Record<string, string>>;
}) {
  const headingId = useId();
  const [values, setValues] = useState(() =>
    Object.fromEntries(repos.map((repo) => [repo, abbreviations[repo] ?? ''])),
  );
  const [outcome, setOutcome] = useState<Outcome>(() => {
    const [clash] = findAbbreviationClashes(resolveAbbreviations(repos, abbreviations));
    return clash ? { kind: 'error', message: describeAbbreviationClash(clash) } : undefined;
  });
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmed = Object.fromEntries(repos.map((repo) => [repo, (values[repo] ?? '').trim()]));
    const invalid = repos.find((repo) => trimmed[repo] !== '' && !isValidAbbreviation(trimmed[repo] ?? ''));
    if (invalid !== undefined) {
      setOutcome({ kind: 'error', message: describeInvalidAbbreviation(invalid, trimmed[invalid] ?? '') });
      return;
    }
    const stored = Object.fromEntries(Object.entries(trimmed).filter(([, value]) => value !== ''));
    const [clash] = findAbbreviationClashes(resolveAbbreviations(repos, stored));
    if (clash) {
      setOutcome({ kind: 'error', message: describeAbbreviationClash(clash) });
      return;
    }
    setIsSaving(true);
    const refusal = await onSave(trimmed);
    setIsSaving(false);
    if (refusal !== undefined) {
      setOutcome({ kind: 'error', message: refusal });
      return;
    }
    setOutcome({ kind: 'saved' });
    setValues(trimmed);
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Repo abbreviations</h2>
      {repos.map((repo) => (
        <label className="tr-settings-field" key={repo}>
          <span>{repo}</span>
          <input
            className="tr-input"
            onChange={(event) => setValues((current) => ({ ...current, [repo]: event.target.value }))}
            placeholder={abbreviate(repo)}
            value={values[repo] ?? ''}
          />
        </label>
      ))}
      <OutcomeMessage outcome={outcome} />
      <div className="tr-settings-actions">
        <button className="tr-button" disabled={isSaving} type="submit">
          Save
        </button>
      </div>
    </form>
  );
}

/** The success note or the refusal of the last save. */
function OutcomeMessage({ outcome }: { outcome: Outcome }) {
  if (outcome === undefined) return null;
  if (outcome.kind === 'saved') {
    return (
      <p className="tr-settings-saved" role="status">
        Saved.
      </p>
    );
  }
  return (
    <p className="tr-settings-error" role="alert">
      {outcome.message}
    </p>
  );
}

/** Returns the labels of a comma-separated field. */
function parseLabels(text: string): string[] {
  return text.split(',');
}

/** The labels that supply each urgency and value level, refused while one label is under two levels. */
function ScoreLabelMappingForm({
  saved,
  onSave,
}: {
  saved: ScoreLabelMapping | undefined;
  onSave: SaveSettings<ScoreLabelMapping | undefined>;
}) {
  const headingId = useId();
  const hintId = useId();
  const [texts, setTexts] = useState(() => toLevelTexts(saved ?? DEFAULT_SCORE_LABEL_MAPPING));
  const [outcome, setOutcome] = useState<Outcome>();
  const [isSaving, setIsSaving] = useState(false);

  async function submit(mapping: ScoreLabelMapping | undefined): Promise<void> {
    setIsSaving(true);
    const refusal = await onSave(mapping);
    setIsSaving(false);
    if (refusal !== undefined) {
      setOutcome({ kind: 'error', message: refusal });
      return;
    }
    setOutcome({ kind: 'saved' });
    setTexts(toLevelTexts(mapping ?? DEFAULT_SCORE_LABEL_MAPPING));
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const mapping = normalizeScoreLabelMapping({
      urgency: {
        critical: parseLabels(texts.critical),
        high: parseLabels(texts.high),
        low: parseLabels(texts.low),
        medium: parseLabels(texts.medium),
      },
      value: {
        'must-have': parseLabels(texts['must-have']),
        'nice-to-have': parseLabels(texts['nice-to-have']),
        questionable: parseLabels(texts.questionable),
        'should-have': parseLabels(texts['should-have']),
      },
    });
    const [duplicate] = findDuplicateScoreLabels(mapping);
    if (duplicate) {
      setOutcome({ kind: 'error', message: describeDuplicateScoreLabel(duplicate) });
      return;
    }
    await submit(mapping);
  }

  function renderLevels(legend: string, levels: ReadonlyArray<UrgencyLevel | ValueLevel>) {
    return (
      <fieldset className="tr-settings-group">
        <legend>{legend}</legend>
        {levels.toReversed().map((level) => (
          <label className="tr-settings-field" key={level}>
            <span>{LEVEL_NAMES[level]}</span>
            <input
              aria-describedby={hintId}
              className="tr-input"
              onChange={(event) => setTexts((current) => ({ ...current, [level]: event.target.value }))}
              value={texts[level]}
            />
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Score labels</h2>
      <p className="tr-settings-hint" id={hintId}>
        Comma-separated labels. Case is ignored.
      </p>
      {renderLevels('Urgency', URGENCY_LEVELS)}
      {renderLevels('Value', VALUE_LEVELS)}
      <OutcomeMessage outcome={outcome} />
      <div className="tr-settings-actions">
        <button className="tr-button" disabled={isSaving} type="submit">
          Save
        </button>
        <button className="tr-button" disabled={isSaving} onClick={() => void submit(undefined)} type="button">
          Restore defaults
        </button>
      </div>
    </form>
  );
}

/** Returns each level's labels as the comma-separated text of its field. */
function toLevelTexts(mapping: ScoreLabelMapping): Record<UrgencyLevel | ValueLevel, string> {
  return {
    critical: mapping.urgency.critical.join(', '),
    high: mapping.urgency.high.join(', '),
    low: mapping.urgency.low.join(', '),
    medium: mapping.urgency.medium.join(', '),
    'must-have': mapping.value['must-have'].join(', '),
    'nice-to-have': mapping.value['nice-to-have'].join(', '),
    questionable: mapping.value.questionable.join(', '),
    'should-have': mapping.value['should-have'].join(', '),
  };
}

/** Returns each work type's labels as the comma-separated text of its field. */
function toTexts(mapping: WorkTypeMapping): Record<MappedWorkType, string> {
  return {
    bug: mapping.bug.join(', '),
    feature: mapping.feature.join(', '),
    ops: mapping.ops.join(', '),
    task: mapping.task.join(', '),
  };
}

/** The labels that assign each work type, refused while one label is in two types. */
function WorkTypeMappingForm({
  saved,
  onSave,
}: {
  saved: WorkTypeMapping | undefined;
  onSave: SaveSettings<WorkTypeMapping | undefined>;
}) {
  const headingId = useId();
  const hintId = useId();
  const [texts, setTexts] = useState(() => toTexts(saved ?? DEFAULT_WORK_TYPE_MAPPING));
  const [outcome, setOutcome] = useState<Outcome>();
  const [isSaving, setIsSaving] = useState(false);

  async function submit(mapping: WorkTypeMapping | undefined): Promise<void> {
    setIsSaving(true);
    const refusal = await onSave(mapping);
    setIsSaving(false);
    if (refusal !== undefined) {
      setOutcome({ kind: 'error', message: refusal });
      return;
    }
    setOutcome({ kind: 'saved' });
    setTexts(toTexts(mapping ?? DEFAULT_WORK_TYPE_MAPPING));
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const mapping = normalizeWorkTypeMapping({
      bug: parseLabels(texts.bug),
      feature: parseLabels(texts.feature),
      ops: parseLabels(texts.ops),
      task: parseLabels(texts.task),
    });
    const [duplicate] = findDuplicateLabels(mapping);
    if (duplicate) {
      setOutcome({ kind: 'error', message: describeDuplicateLabel(duplicate) });
      return;
    }
    await submit(mapping);
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Work types</h2>
      <p className="tr-settings-hint" id={hintId}>
        Comma-separated labels. Case is ignored.
      </p>
      {MAPPED_WORK_TYPES.map((workType) => (
        <label className="tr-settings-field" data-work-type={workType} key={workType}>
          <span>
            <CircleIcon />
            {WORK_TYPE_NAMES[workType]}
          </span>
          <input
            aria-describedby={hintId}
            className="tr-input"
            onChange={(event) => setTexts((current) => ({ ...current, [workType]: event.target.value }))}
            value={texts[workType]}
          />
        </label>
      ))}
      <OutcomeMessage outcome={outcome} />
      <div className="tr-settings-actions">
        <button className="tr-button" disabled={isSaving} type="submit">
          Save
        </button>
        <button className="tr-button" disabled={isSaving} onClick={() => void submit(undefined)} type="button">
          Restore defaults
        </button>
      </div>
    </form>
  );
}
// endregion | Helpers
