import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StatTone = 'accent' | 'good' | 'warn' | 'crit' | 'info' | 'neutral';

const TONE: Record<StatTone, { fg: string; chip: string; bar: string }> = {
  accent: { fg: 'text-accent-strong dark:text-accent', chip: 'bg-accent-soft text-accent', bar: 'bg-accent' },
  good: { fg: 'text-good', chip: 'bg-good-soft text-good', bar: 'bg-good' },
  warn: { fg: 'text-warn', chip: 'bg-warn-soft text-warn', bar: 'bg-warn' },
  crit: { fg: 'text-crit', chip: 'bg-crit-soft text-crit', bar: 'bg-crit' },
  info: { fg: 'text-info', chip: 'bg-info-soft text-info', bar: 'bg-info' },
  neutral: { fg: 'text-ink', chip: 'bg-surface-3 text-ink-2', bar: 'bg-line-2' },
};

export interface StatCardProps {
  icon: LucideIcon;
  /** Value counted by the service layer; strings only for formatted money. */
  value: number | string;
  /** Label including the unit, e.g. "hồ sơ đang mở". */
  label: string;
  tone?: StatTone;
  hint?: string;
  /** Clickable card linking to the filtered list. */
  to?: string;
}

const CARD = 'group relative block h-full overflow-hidden rounded-xl border border-line/90 bg-surface p-4 pl-5 shadow-card transition-colors';

/** KPI tile: tone stripe on the left, label on top, large number, icon chip. */
export const StatCard = ({ icon: Icon, value, label, tone = 'accent', hint, to }: StatCardProps) => {
  const colors = TONE[tone];
  const body = (
    <>
      <span className={cn('absolute inset-y-0 left-0 w-1', colors.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', colors.chip)}>
          <Icon className="size-[17px]" aria-hidden />
        </span>
      </div>
      <p className={cn('mt-2.5 break-words font-bold leading-tight tracking-[-0.04em] tabular-nums', String(value).length >= 10 ? 'text-xl' : 'text-[1.85rem]', colors.fg)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
      {to ? (
        <ArrowUpRight className="absolute bottom-3 right-3 size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      ) : null}
    </>
  );
  if (!to) return <div className={CARD}>{body}</div>;
  return (
    <Link to={to} className={cn(CARD, 'hover:-translate-y-0.5 hover:shadow-pop')}>
      {body}
    </Link>
  );
};

export const StatCardRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5', className)}>{children}</div>
);
