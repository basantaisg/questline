'use client';

import { ClipboardEvent, KeyboardEvent, useEffect, useRef } from 'react';

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Fires once the sixth digit lands, so the form can submit itself. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Six single-character boxes backed by one string. Each box is a real input, so
 * password managers and the iOS/Android SMS-autofill keyboard still work.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  };

  const setDigit = (index: number, digit: string) => {
    const clean = digit.replace(/\D/g, '');
    if (!clean) return;

    // Typing over a box mid-string replaces that one digit; typing in the last
    // filled box appends. Padding keeps the indices stable either way.
    const chars = value.padEnd(LENGTH, ' ').split('');
    chars[index] = clean[0];
    commit(chars.join('').replace(/ /g, '').slice(0, LENGTH));

    boxes.current[Math.min(index + 1, LENGTH - 1)]?.focus();
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      // Backspace in an empty box steps back and clears the previous one —
      // otherwise the caret gets stuck and the box feels broken.
      const target = value[index] ? index : index - 1;
      if (target < 0) return;
      commit(value.slice(0, target) + value.slice(target + 1));
      boxes.current[target]?.focus();
    } else if (e.key === 'ArrowLeft') {
      boxes.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight') {
      boxes.current[index + 1]?.focus();
    }
  };

  // Pasting the whole code from the email is the common path — fill every box.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    commit(digits);
    boxes.current[Math.min(digits.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="mt-3 flex justify-between gap-2" role="group" aria-label="6-digit code">
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ''}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className="h-14 w-full rounded-xl border border-white/15 bg-white/[0.04] text-center font-mono text-2xl font-700 text-neon-cyan outline-none transition-all duration-200 focus:border-neon-cyan/60 focus:shadow-neon-cyan disabled:opacity-40"
        />
      ))}
    </div>
  );
}
