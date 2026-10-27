import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TaskMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  tone: 'good' | 'crit' | 'warn' | 'neutral';
  onSelect: () => void;
  /** The card is the active list filter (ui-brief §1, §4: a toggle button). */
  pressed?: boolean;
}

const TONE = {
  good: { icon: 'bg-good-soft text-good', value: 'text-good', bar: 'bg-good' },
  crit: { icon: 'bg-crit-soft text-crit', value: 'text-crit', bar: 'bg-crit' },
  warn: { icon: 'bg-warn-soft text-warn', value: 'text-warn', bar: 'bg-warn' },
  neutral: { icon: 'bg-surface-3 text-ink-2', value: 'text-ink', bar: 'bg-line-2' },
} as const;

/** Compact, clickable task metric used to jump to the related view. */
export const TaskMetricCard = ({ icon: Icon, label, value, hint, tone, onSelect, pressed = false }: TaskMetricCardProps) => {
  const colors = TONE[tone];
  return (
    <button type="button" aria-pressed={pressed} onClick={onSelect} className={cn('group relative flex min-h-[6.25rem] items-center gap-3 overflow-hidden rounded-xl border bg-surface px-4 py-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop sm:gap-4 sm:px-5', pressed ? 'border-accent' : 'border-line/90')}>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', colors.icon)}><Icon className="size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink-2">{label}</span><span className={cn('mt-0.5 block text-[1.85rem] font-bold leading-none tracking-[-0.04em] tabular-nums', colors.value)}>{value}</span><span className="mt-1 block truncate text-xs text-ink-3">{hint}</span></span>
      <span className="text-lg text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden>›</span>
      <span className={cn('absolute inset-x-0 bottom-0 h-0.5 opacity-70', colors.bar)} aria-hidden />
    </button>
  );
};
