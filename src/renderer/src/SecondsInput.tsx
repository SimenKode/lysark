// A number of seconds, written the Norwegian way ("7,5"), taken when the
// field is left or Enter is pressed. Used for how long a slide without
// sound stands, in the tab «Lysark» and in the tab «Lyd».
import { useEffect, useState } from 'react';

/** "7,5": seconds with at most one decimal and a decimal comma. */
export function formatSeconds(seconds: number): string {
  return String(Math.round(seconds * 10) / 10).replace('.', ',');
}

export function parseSecondsText(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
}

export function SecondsInput(props: {
  value: number;
  onChange: (seconds: number) => void;
  label: string;
  min: number;
  max: number;
  className?: string;
  id?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState(formatSeconds(props.value));
  useEffect(() => setText(formatSeconds(props.value)), [props.value]);
  const commit = (): void => {
    const raw = parseSecondsText(text);
    const value = raw === undefined ? undefined : Math.max(props.min, Math.min(props.max, raw));
    if (value === undefined || Math.abs(value - props.value) < 0.05) {
      setText(formatSeconds(props.value));
      return;
    }
    setText(formatSeconds(value));
    props.onChange(value);
  };
  return (
    <input
      id={props.id}
      type="text"
      inputMode="decimal"
      className={props.className}
      value={text}
      aria-label={props.label}
      aria-describedby={props.describedBy}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}
