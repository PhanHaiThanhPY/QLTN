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
  /** Uses a denser layout for report KPI rows with short supporting hints. */
  compact?: boolean;
  /** Clickable card linking to the filtered list. */
  to?: string;
  /** Clickable card used by dashboards to focus an in-page report. */
  onClick?: () => void;
}

const CARD = 'group relative block h-full overflow-hidden rounded-xl border border-line/90 bg-surface p-4 pl-5 shadow-card transition-colors';
const COMPACT_CARD = 'group relative block min-h-[6.5rem] h-full overflow-hidden rounded-xl border border-line/90 bg-surface p-3 pl-4 shadow-card transition-colors';

/** KPI tile: tone stripe on the left, label on top, large number, icon chip. */
export const StatCard = ({ icon: Icon, value, label, tone = 'accent', hint, compact = false, to, onClick }: StatCardProps) => {
  const colors = TONE[tone];
  const cardClass = compact ? COMPACT_CARD : CARD;
  const body = (
    <>
      <span className={cn('absolute inset-y-0 left-0 w-1', colors.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2.5">
        <p className={cn('min-w-0 font-semibold uppercase tracking-[0.08em] text-ink-3', compact ? 'text-[0.68rem] leading-4' : 'text-[0.75rem]')}>{label}</p>
        <span className={cn('flex shrink-0 items-center justify-center rounded-xl', compact ? 'size-8' : 'size-9', colors.chip)}>
          <Icon className={cn(compact ? 'size-4' : 'size-17px]')} aria-hidden />
        </span>
      </div>
      <div className={cn('flex items-end justify-between gap-2', compact ? 'mt-2' : 'mt-2.5')}>
        <p className={cn('min-w-0 font-bold leading-tight tracking-[-0.04em] tabular-nums', compact ? 'shrink-0 whitespace-nowrap' : 'break-words', compact ? (String(value).length >= 10 ? 'text-[1.15rem]' : 'text-[1.65rem]') : String(value).length >= 10 ? 'text-xl' : 'text-[1.85rem]', colors.fg)}>
          {value}
        </p>
        {compact && hint ? <p className="max-w-[7rem] pb-0.5 text-right text-[0.68rem] leading-4 text-ink-3">{hint}</p> : null}
      </div>
      {!compact && hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
      {to ? (
        <ArrowUpRight className={cn('absolute size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100', compact ? 'bottom-2.5 right-2.5' : 'bottom-3 right-3')} aria-hidden />
      ) : null}
    </>
  );
  if (onClick) {
    return <button type="button" className={cn(cardClass, 'w-full cursor-pointer text-left hover:-translate-y-0.5 hover:shadow-pop')} onClick={onClick}>{body}</button>;
  }
  if (!to) return <div className={cardClass}>{body}</div>;
  return (
    <Link to={to} className={cn(cardClass, 'hover:-translate-y-0.5 hover:shadow-pop')}>
      {body}
    </Link>
  );
};

export const StatCardRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5', className)}>{children}</div>
);
