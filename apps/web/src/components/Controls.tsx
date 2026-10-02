import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/** Number field with − / + buttons. Typing is free; the value is committed on blur or Enter. */
export function Stepper(props: {
  name: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const { value, min, max } = props;
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n)) props.onChange(n);
    else setDraft(value === null ? '' : String(value));
  };
  return (
    <div className="stepper">
      <label className="field-label" htmlFor={props.name}>
        {props.label}
      </label>
      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${props.label}: меньше`}
          disabled={value !== null && value <= min}
          onClick={() => props.onChange((value ?? min) - 1)}
        >
          <Icon name="minus" size={14} />
        </button>
        <span className="stepper-input">
          <input
            id={props.name}
            name={props.name}
            className="num"
            inputMode="numeric"
            value={draft}
            placeholder="—"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
          />
          {props.suffix && <span className="stepper-suffix">{props.suffix}</span>}
        </span>
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${props.label}: больше`}
          disabled={value !== null && value >= max}
          onClick={() => props.onChange((value ?? min - 1) + 1)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

/** One choice out of a few, as a row of toggle buttons. */
export function Segmented<T extends string | number>(props: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="segmented-field">
      {!props.hideLabel && <span className="field-label">{props.label}</span>}
      <div className="segmented" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
