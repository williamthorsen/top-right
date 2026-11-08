import { type KeyboardEvent, type ReactElement, useRef } from 'react';

export interface SegmentOption<T extends number | string> {
  value: T;
  label: string;
  /** Whether the segment shows a state that the user cannot choose. */
  isDisabled?: boolean;
}

export interface SegmentedControlProps<T extends number | string> {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | undefined;
  onChange: (value: T) => void;
  /** Whether the whole control only shows its value. */
  isReadOnly?: boolean;
}

const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);

/**
 * A radio group drawn as joined segments: one tab stop, the checked segment's (else the first's), and the arrow keys
 * move to and choose the neighbouring segment that is not disabled.
 */
export function SegmentedControl<T extends number | string>({
  label,
  options,
  value,
  onChange,
  isReadOnly = false,
}: SegmentedControlProps<T>): ReactElement {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabIndex = checkedIndex === -1 ? 0 : checkedIndex;

  function isChoosable(option: SegmentOption<T> | undefined): option is SegmentOption<T> {
    return option !== undefined && !option.isDisabled && !isReadOnly;
  }

  function moveOnArrow(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = PREVIOUS_KEYS.has(event.key) ? -1 : NEXT_KEYS.has(event.key) ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    for (let next = index + step; next >= 0 && next < options.length; next += step) {
      const option = options[next];
      if (!isChoosable(option)) continue;
      onChange(option.value);
      buttons.current[next]?.focus();
      return;
    }
  }

  return (
    <span aria-label={label} aria-readonly={isReadOnly || undefined} className="tr-seg" role="radiogroup">
      {options.map((option, index) => (
        <button
          aria-checked={option.value === value}
          aria-disabled={option.isDisabled || isReadOnly || undefined}
          className="tr-seg-option"
          key={option.value}
          onClick={() => {
            if (isChoosable(option) && option.value !== value) onChange(option.value);
          }}
          onKeyDown={(event) => moveOnArrow(event, index)}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          role="radio"
          tabIndex={index === tabIndex ? 0 : -1}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
