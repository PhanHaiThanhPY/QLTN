import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import type { CheckResult } from '@/services/maintenance-occurrences-api';
import { RESULTS, RESULT_TEXT } from './occurrence-ui';

interface ResultRadioGroupProps {
  label: string;
  value: CheckResult | null;
  onChange: (value: CheckResult) => void;
  /** Locked on FAIL when a measurement is out of range (D-MT3-2). */
  lockedTo?: CheckResult;
  disabled?: boolean;
  describedBy?: string;
}

const SELECTED: Readonly<Record<CheckResult, string>> = {
  PASS: 'border-good bg-good-soft text-good',
  FAIL: 'border-crit bg-crit-soft text-crit',
  NA: 'border-line-2 bg-surface-2 text-ink',
} as const;

/** Đạt / Lỗi / Không áp dụng as one radio group: arrows move and choose, 44px targets (ui-brief §1, §4). */
export const ResultRadioGroup = ({ label, value, onChange, lockedTo, disabled = false, describedBy }: ResultRadioGroupProps) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = lockedTo ?? value;
  const focusIndex = Math.max(0, RESULTS.findIndex((result) => result === shown));
  const choose = (index: number) => {
    const next = RESULTS[(index + RESULTS.length) % RESULTS.length];
    if (lockedTo && next !== lockedTo) return;
    onChange(next);
    refs.current[(index + RESULTS.length) % RESULTS.length]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      choose(index + 1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      choose(index - 1);
    }
  };
  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="grid grid-cols-3 gap-1.5">
      {RESULTS.map((result, index) => {
        const checked = shown === result;
        const blocked = disabled || Boolean(lockedTo && result !== lockedTo);
        return (
          <button
            key={result}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={blocked}
            onClick={() => onChange(result)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              checked ? SELECTED[result] : 'border-line bg-surface text-ink-2 hover:border-accent',
            )}
          >
            {RESULT_TEXT[result]}
          </button>
        );
      })}
    </div>
  );
};
