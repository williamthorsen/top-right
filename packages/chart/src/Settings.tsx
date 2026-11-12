import {
  abbreviate,
  DEFAULT_SCORE_LABEL_MAPPING,
  DEFAULT_WORK_TYPE_MAPPING,
  describeAbbreviationClash,
  describeDuplicateLabel,
  describeDuplicateScoreLabel,
  describeInvalidAbbreviation,
  EFFORT_SCALE,
  type EffortPoints,
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
import { type ReactElement, type ReactNode, type SubmitEvent, useId, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { LEVEL_NAMES } from './level-names.ts';
import { formatPoints } from './provenance.ts';

import './chart.css';

/** Reports the outcome of a save: the host's refusal message, or undefined when the save succeeded. */
export type SaveSettings<T> = (value: T) => Promise<string | undefined>;

export interface SettingsProps {
  /** The configured repositories, as `owner/name`. */
  repos: readonly string[];
  /** The user's stored abbreviations; a repository without one takes its uppercase first letter. */
  abbreviations: Readonly<Record<string, string>>;
  /** The user's saved mapping; undefined when the user keeps the default. */
  workTypeMapping: WorkTypeMapping | undefined;
  /** The user's saved score-label mapping; undefined when the user keeps the default. */
  scoreLabelMapping: ScoreLabelMapping | undefined;
  /** Saves each configured repository's abbreviation, an empty string standing for its default. */
  onSaveAbbreviations: SaveSettings<Record<string, string>>;
  /** Saves the mapping, or restores the default when passed undefined. */
  onSaveWorkTypeMapping: SaveSettings<WorkTypeMapping | undefined>;
  /** Saves the score-label mapping, or restores the default when passed undefined. */
  onSaveScoreLabelMapping: SaveSettings<ScoreLabelMapping | undefined>;
  /** The host's own sections, shown after the forms. */
  children?: ReactNode;
}

/**
 * The Settings page: the labels that assign each work type, the labels that supply each urgency level, value level,
 * and effort, each repository's abbreviation, and the host's own sections.
 */
export function Settings({
  repos,
  abbreviations,
  workTypeMapping,
  scoreLabelMapping,
  onSaveAbbreviations,
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
      {children}
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

/** Returns the mapping that the score-label form's fields state, before normalization. */
function parseScoreLabelTexts(texts: Readonly<Record<ScoreLabelKey, string>>): ScoreLabelMapping {
  function read(key: ScoreLabelKey): string[] {
    return parseLabels(texts[key]);
  }
  return {
    urgency: {
      critical: read('urgency:critical'),
      high: read('urgency:high'),
      low: read('urgency:low'),
      medium: read('urgency:medium'),
    },
    value: {
      'must-have': read('value:must-have'),
      'nice-to-have': read('value:nice-to-have'),
      questionable: read('value:questionable'),
      'should-have': read('value:should-have'),
    },
    effort: {
      1: read('effort:1'),
      2: read('effort:2'),
      3: read('effort:3'),
      5: read('effort:5'),
      8: read('effort:8'),
      13: read('effort:13'),
    },
  };
}

/** The score-label form's fields by dimension, each keyed `<dimension>:<entry>` and in descending rank. */
const SCORE_LABEL_GROUPS: ReadonlyArray<{ legend: string; fields: readonly ScoreLabelField[] }> = [
  {
    legend: 'Urgency',
    fields: URGENCY_LEVELS.toReversed().map((level): ScoreLabelField => ({
      key: `urgency:${level}`,
      name: LEVEL_NAMES[level],
    })),
  },
  {
    legend: 'Value',
    fields: VALUE_LEVELS.toReversed().map((level): ScoreLabelField => ({
      key: `value:${level}`,
      name: LEVEL_NAMES[level],
    })),
  },
  {
    legend: 'Effort',
    fields: EFFORT_SCALE.toReversed().map((points): ScoreLabelField => ({
      key: `effort:${points}`,
      name: formatPoints(points),
    })),
  },
];

interface ScoreLabelField {
  key: ScoreLabelKey;
  name: string;
}

/** A field of the score-label form, named `<dimension>:<entry>`. */
type ScoreLabelKey = `effort:${EffortPoints}` | `urgency:${UrgencyLevel}` | `value:${ValueLevel}`;

/** The labels that supply each urgency level, value level, and effort, refused while one label is under two entries. */
function ScoreLabelMappingForm({
  saved,
  onSave,
}: {
  saved: ScoreLabelMapping | undefined;
  onSave: SaveSettings<ScoreLabelMapping | undefined>;
}) {
  const headingId = useId();
  const hintId = useId();
  const [texts, setTexts] = useState(() => toScoreLabelTexts(saved ?? DEFAULT_SCORE_LABEL_MAPPING));
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
    setTexts(toScoreLabelTexts(mapping ?? DEFAULT_SCORE_LABEL_MAPPING));
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const mapping = normalizeScoreLabelMapping(parseScoreLabelTexts(texts));
    const [duplicate] = findDuplicateScoreLabels(mapping);
    if (duplicate) {
      setOutcome({ kind: 'error', message: describeDuplicateScoreLabel(duplicate) });
      return;
    }
    await submit(mapping);
  }

  return (
    <form aria-labelledby={headingId} className="tr-settings-section" onSubmit={(event) => void save(event)}>
      <h2 id={headingId}>Score labels</h2>
      <p className="tr-settings-hint" id={hintId}>
        Comma-separated labels. Case is ignored.
      </p>
      {SCORE_LABEL_GROUPS.map(({ legend, fields }) => (
        <fieldset className="tr-settings-group" key={legend}>
          <legend>{legend}</legend>
          {fields.map(({ key, name }) => (
            <label className="tr-settings-field" key={key}>
              <span>{name}</span>
              <input
                aria-describedby={hintId}
                className="tr-input"
                onChange={(event) => setTexts((current) => ({ ...current, [key]: event.target.value }))}
                value={texts[key]}
              />
            </label>
          ))}
        </fieldset>
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

/** Returns each entry's labels as the comma-separated text of its field, keyed `<dimension>:<entry>`. */
function toScoreLabelTexts({ urgency, value, effort }: ScoreLabelMapping): Record<ScoreLabelKey, string> {
  return {
    'urgency:critical': urgency.critical.join(', '),
    'urgency:high': urgency.high.join(', '),
    'urgency:low': urgency.low.join(', '),
    'urgency:medium': urgency.medium.join(', '),
    'value:must-have': value['must-have'].join(', '),
    'value:nice-to-have': value['nice-to-have'].join(', '),
    'value:questionable': value.questionable.join(', '),
    'value:should-have': value['should-have'].join(', '),
    'effort:1': effort[1].join(', '),
    'effort:2': effort[2].join(', '),
    'effort:3': effort[3].join(', '),
    'effort:5': effort[5].join(', '),
    'effort:8': effort[8].join(', '),
    'effort:13': effort[13].join(', '),
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
