import {
  DEFAULT_WORK_TYPE_MAPPING,
  describeDuplicateLabel,
  findDuplicateLabels,
  MAPPED_WORK_TYPES,
  type MappedWorkType,
  normalizeWorkTypeMapping,
  WORK_TYPE_NAMES,
  type WorkTypeMapping,
} from '@top-right/model';
import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

import { CircleIcon } from './CircleIcon.tsx';
import { type Outcome, OutcomeMessage, type SaveSettings } from './OutcomeMessage.tsx';
import { parseLabels } from './parse-labels.ts';

/** The labels that assign each work type, refused while one label is in two types. */
export function WorkTypeMappingForm({
  saved,
  onSave,
}: {
  saved: WorkTypeMapping | undefined;
  onSave: SaveSettings<WorkTypeMapping | undefined>;
}): ReactElement {
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

// region | Helpers
/** Returns each work type's labels as the comma-separated text of its field. */
function toTexts(mapping: WorkTypeMapping): Record<MappedWorkType, string> {
  return {
    bug: mapping.bug.join(', '),
    feature: mapping.feature.join(', '),
    ops: mapping.ops.join(', '),
    task: mapping.task.join(', '),
  };
}
// endregion | Helpers
