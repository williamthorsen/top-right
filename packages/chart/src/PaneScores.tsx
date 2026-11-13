import {
  deriveStatus,
  EFFORT_SCALE,
  type ItemRef,
  PROGRESS_STEP,
  type ResolvedItemScores,
  type ScoreField,
  type Scores,
  type StatusOverride,
  URGENCY_LEVELS,
  VALUE_LEVELS,
} from '@top-right/model';
import { type ReactElement, useEffect, useEffectEvent, useRef, useState } from 'react';

import { LEVEL_NAMES, SHORT_VALUE_NAMES } from './level-names.ts';
import { formatScoreCaption } from './provenance.ts';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { STATUS_NAMES } from './status-names.ts';

/** A status that the pane can set; Done is read from the source. */
export type SettableStatus = 'in-progress' | 'to-do';

export interface PaneScoresProps {
  item: Pick<ItemRef, 'state'>;
  scores: ResolvedItemScores | undefined;
  override: StatusOverride | undefined;
  onScoresChange: (scores: Scores) => void;
  /** Clears one of the item's scores; without it, the rows offer no clear button. */
  onScoresClear: ((field: ScoreField) => void) | undefined;
  onStatusChange: (status: SettableStatus) => void;
}

const STATUS_OPTIONS: ReadonlyArray<SegmentOption<'done' | SettableStatus>> = [
  { value: 'to-do', label: STATUS_NAMES['to-do'] },
  { value: 'in-progress', label: STATUS_NAMES['in-progress'] },
  { value: 'done', label: STATUS_NAMES.done, isDisabled: true },
];

const URGENCY_OPTIONS = URGENCY_LEVELS.map((value) => ({ value, label: LEVEL_NAMES[value] }));
const VALUE_OPTIONS = VALUE_LEVELS.map((value) => ({
  value,
  label: LEVEL_NAMES[value],
  shortLabel: SHORT_VALUE_NAMES[value],
}));
const EFFORT_OPTIONS = EFFORT_SCALE.map((value) => ({ value, label: String(value) }));
const PERCENT = 100;

/**
 * The pane's Scores section: the status and the four scores, each with a clear button while it has a score and a
 * caption where the control cannot show who set the score.
 */
export function PaneScores({
  item,
  scores,
  override,
  onScoresChange,
  onScoresClear,
  onStatusChange,
}: PaneScoresProps): ReactElement {
  const status = deriveStatus(item, override);
  const isClosed = item.state === 'closed';
  const section = useRef<HTMLElement>(null);
  // The row whose score was just cleared, whose control takes the focus once the row re-renders without its button.
  const [cleared, setCleared] = useState<{ field: ScoreField }>();

  useEffect(() => {
    if (!cleared) return;
    const row = section.current?.querySelector(`[data-field="${CSS.escape(cleared.field)}"]`);
    row?.querySelector<HTMLElement>('[tabindex="0"], input')?.focus();
  }, [cleared]);

  function clearScore(field: ScoreField): (() => void) | undefined {
    if (!onScoresClear) return undefined;
    return () => {
      onScoresClear(field);
      setCleared({ field });
    };
  }

  return (
    <section aria-label="Scores" className="tr-scores" ref={section}>
      <h3>Scores</h3>
      <div className="tr-score">
        <span className="tr-score-name">Status</span>
        <SegmentedControl
          isReadOnly={isClosed}
          label="Status"
          onChange={(value) => {
            if (value !== 'done') onStatusChange(value);
          }}
          options={STATUS_OPTIONS}
          value={status}
        />
        {isClosed ? <span className="tr-score-who">Closed at the source</span> : null}
      </div>
      <ScoreRow
        caption={formatScoreCaption('urgency', scores?.urgency)}
        label="Urgency"
        onChange={(urgency) => onScoresChange({ urgency })}
        onClear={clearScore('urgency')}
        options={URGENCY_OPTIONS}
        field="urgency"
        value={scores?.urgency?.score}
      />
      <ScoreRow
        caption={formatScoreCaption('value', scores?.value)}
        label="Value"
        onChange={(value) => onScoresChange({ value })}
        onClear={clearScore('value')}
        options={VALUE_OPTIONS}
        field="value"
        value={scores?.value?.score}
      />
      <ScoreRow
        caption={formatScoreCaption('effort', scores?.effort)}
        label="Effort"
        onChange={(value) => onScoresChange({ effort: value })}
        onClear={clearScore('effort')}
        options={EFFORT_OPTIONS}
        field="effort"
        value={scores?.effort?.score}
      />
      <ProgressRow
        caption={formatScoreCaption('progress', scores?.progress)}
        onClear={clearScore('progress')}
        onCommit={(value) => onScoresChange({ progress: value })}
        value={scores?.progress?.score}
      />
    </section>
  );
}

// region | Helpers
/** The × that clears a row's score, hidden while the row has none so that the row keeps its width. */
function ClearButton({ label, isShown, onClear }: { label: string; isShown: boolean; onClear: () => void }) {
  return (
    <button
      aria-label={`Clear ${label.toLowerCase()}`}
      className="tr-score-clear"
      data-hidden={isShown ? undefined : 'true'}
      onClick={onClear}
      type="button"
    >
      ×
    </button>
  );
}

/** The Progress row: a range from 0 to 100 % in steps of 5, committed when the thumb is released. */
function ProgressRow({
  value,
  caption,
  onClear,
  onCommit,
}: {
  value: number | undefined;
  caption: string | undefined;
  onClear: (() => void) | undefined;
  onCommit: (value: number) => void;
}) {
  // A draft is kept only while it belongs to the stored value that it started from, so a new value resets it.
  const [draft, setDraft] = useState<{ from: number | undefined; percent: number }>();
  const percent = draft !== undefined && draft.from === value ? draft.percent : toPercent(value);
  const input = useRef<HTMLInputElement>(null);
  const commitChange = useEffectEvent((fraction: number) => onCommit(fraction));

  // React's `onChange` fires on every input event, and a write per step would flood the store; the native `change`
  // event fires once, when the user releases the thumb or presses a key.
  useEffect(() => {
    const element = input.current;
    function commitOnChange(event: Event): void {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      commitChange(Number(event.currentTarget.value) / PERCENT);
      // Drop the draft, which would otherwise show again once a clear returns the value to the one it started from.
      setDraft(undefined);
    }
    element?.addEventListener('change', commitOnChange);
    return () => element?.removeEventListener('change', commitOnChange);
  }, []);

  return (
    <div className="tr-score" data-field="progress">
      <label className="tr-score-name" htmlFor="tr-progress">
        Progress
      </label>
      <span className="tr-progress">
        <input
          id="tr-progress"
          max={PERCENT}
          min={0}
          onChange={(event) => setDraft({ from: value, percent: Number(event.target.value) })}
          ref={input}
          step={PROGRESS_STEP * PERCENT}
          type="range"
          value={percent}
        />
        <output htmlFor="tr-progress">{value === undefined && percent === 0 ? '–' : `${percent} %`}</output>
        {onClear ? <ClearButton isShown={value !== undefined} label="Progress" onClear={onClear} /> : null}
      </span>
      {caption === undefined ? null : <span className="tr-score-who">{caption}</span>}
    </div>
  );
}

function ScoreRow<T extends number | string>({
  field,
  label,
  options,
  value,
  caption,
  onChange,
  onClear,
}: {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | undefined;
  field: ScoreField;
  caption: string | undefined;
  onChange: (value: T) => void;
  onClear: (() => void) | undefined;
}) {
  return (
    <div className="tr-score" data-field={field}>
      <span className="tr-score-name">{label}</span>
      <span className="tr-score-control">
        <SegmentedControl label={label} onChange={onChange} options={options} value={value} />
        {onClear ? <ClearButton isShown={value !== undefined} label={label} onClear={onClear} /> : null}
      </span>
      {caption === undefined ? null : <span className="tr-score-who">{caption}</span>}
    </div>
  );
}

function toPercent(value: number | undefined): number {
  return Math.round((value ?? 0) * PERCENT);
}
// endregion | Helpers
