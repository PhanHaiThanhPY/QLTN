import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: 'accent' | 'good' | 'warn';
  label: string;
}

const TONE_CLASS = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn' } as const;

/** Thin progress bar using the native progress semantics. */
export const ProgressBar = ({ value, max = 100, tone = 'accent', label }: ProgressBarProps) => {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={cn('h-full transition-all', TONE_CLASS[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
};
