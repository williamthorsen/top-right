import {
  deriveStatus,
  EFFORT_SCALE,
  type ItemRef,
  type ItemScores,
  PROGRESS_STEP,
  type Scores,
  type StatusOverride,
  URGENCY_LEVELS,
  VALUE_LEVELS,
} from '@top-right/model';
import { type ReactElement, useEffect, useEffectEvent, useRef, useState } from 'react';

import { LEVEL_NAMES } from './level-names.ts';
import { formatPoints, formatProvenance } from './provenance.ts';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { STATUS_NAMES } from './status-names.ts';

/** A status that the pane can set; Done is read from the source. */
export type SettableStatus = 'in-progress' | 'to-do';

export interface PaneScoresProps {
  item: Pick<ItemRef, 'state'>;
  scores: ItemScores | undefined;
  override: StatusOverride | undefined;
  onScoresChange: (scores: Scores) => void;
  onStatusChange: (status: SettableStatus) => void;
}

const STATUS_OPTIONS: ReadonlyArray<SegmentOption<'done' | SettableStatus>> = [
  { value: 'to-do', label: STATUS_NAMES['to-do'] },
  { value: 'in-progress', label: STATUS_NAMES['in-progress'] },
  { value: 'done', label: STATUS_NAMES.done, isDisabled: true },
];

const URGENCY_OPTIONS = URGENCY_LEVELS.map((value) => ({ value, label: LEVEL_NAMES[value] }));
const VALUE_OPTIONS = VALUE_LEVELS.map((value) => ({ value, label: LEVEL_NAMES[value] }));
const EFFORT_OPTIONS = EFFORT_SCALE.map((value) => ({ value, label: String(value) }));
const PERCENT = 100;

/** The pane's Scores section: the status and the four scores, each with its provenance line. */
export function PaneScores({ item, scores, override, onScoresChange, onStatusChange }: PaneScoresProps): ReactElement {
  const status = deriveStatus(item, override);
  const isClosed = item.state === 'closed';

  return (
    <section aria-label="Scores" className="tr-scores">
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
        label="Urgency"
        line={formatProvenance(scores?.urgency)}
        onChange={(urgency) => onScoresChange({ urgency })}
        options={URGENCY_OPTIONS}
        value={scores?.urgency?.score}
      />
      <ScoreRow
        label="Value"
        line={formatProvenance(scores?.value)}
        onChange={(value) => onScoresChange({ value })}
        options={VALUE_OPTIONS}
        value={scores?.value?.score}
      />
      <ScoreRow
        label="Effort"
        line={
          scores?.effort
            ? `${formatPoints(scores.effort.score)} · ${formatProvenance(scores.effort)}`
            : formatPoints(undefined)
        }
        onChange={(value) => onScoresChange({ effort: value })}
        options={EFFORT_OPTIONS}
        value={scores?.effort?.score}
      />
      <ProgressRow
        line={formatProvenance(scores?.progress)}
        onCommit={(value) => onScoresChange({ progress: value })}
        value={scores?.progress?.score}
      />
    </section>
  );
}

// region | Helpers
/** The Progress row: a range from 0 to 100 % in steps of 5, committed when the thumb is released. */
function ProgressRow({
  value,
  line,
  onCommit,
}: {
  value: number | undefined;
  line: string;
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
      if (event.currentTarget instanceof HTMLInputElement) commitChange(Number(event.currentTarget.value) / PERCENT);
    }
    element?.addEventListener('change', commitOnChange);
    return () => element?.removeEventListener('change', commitOnChange);
  }, []);

  return (
    <div className="tr-score">
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
      </span>
      <span className="tr-score-who">{line}</span>
    </div>
  );
}

function ScoreRow<T extends number | string>({
  label,
  options,
  value,
  line,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | undefined;
  line: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tr-score">
      <span className="tr-score-name">{label}</span>
      <SegmentedControl label={label} onChange={onChange} options={options} value={value} />
      <span className="tr-score-who">{line}</span>
    </div>
  );
}

function toPercent(value: number | undefined): number {
  return Math.round((value ?? 0) * PERCENT);
}
// endregion | Helpers
