import {
  DEFAULT_SCORE_LABEL_MAPPING,
  describeDuplicateScoreLabel,
  EFFORT_SCALE,
  type EffortPoints,
  findDuplicateScoreLabels,
  normalizeScoreLabelMapping,
  type ScoreLabelMapping,
  URGENCY_LEVELS,
  type UrgencyLevel,
  VALUE_LEVELS,
  type ValueLevel,
} from '@top-right/model';
import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

import { LEVEL_NAMES } from './level-names.ts';
import { type Outcome, OutcomeMessage, type SaveSettings } from './OutcomeMessage.tsx';
import { parseLabels } from './parse-labels.ts';
import { formatPoints } from './provenance.ts';

/** The labels that supply each urgency level, value level, and effort, refused while one label is under two entries. */
export function ScoreLabelMappingForm({
  saved,
  onSave,
}: {
  saved: ScoreLabelMapping | undefined;
  onSave: SaveSettings<ScoreLabelMapping | undefined>;
}): ReactElement {
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

// region | Helpers
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
// endregion | Helpers
