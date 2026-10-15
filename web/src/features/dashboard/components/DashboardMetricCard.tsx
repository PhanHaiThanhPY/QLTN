import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatTone } from '@/components/ui/stat-card';

interface DashboardMetricCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone: StatTone;
  to: string;
  hint: string;
}

const TONE: Record<StatTone, { icon: string; value: string; bar: string }> = {
  accent: { icon: 'bg-accent-soft text-accent', value: 'text-accent-strong dark:text-accent', bar: 'bg-accent' },
  good: { icon: 'bg-good-soft text-good', value: 'text-good', bar: 'bg-good' },
  warn: { icon: 'bg-warn-soft text-warn', value: 'text-warn', bar: 'bg-warn' },
  crit: { icon: 'bg-crit-soft text-crit', value: 'text-crit', bar: 'bg-crit' },
  info: { icon: 'bg-info-soft text-info', value: 'text-info', bar: 'bg-info' },
  neutral: { icon: 'bg-surface-3 text-ink-2', value: 'text-ink', bar: 'bg-line-2' },
};

/** Horizontal KPI card for the dashboard's action-first summary. */
export const DashboardMetricCard = ({ icon: Icon, value, label, tone, to, hint }: DashboardMetricCardProps) => {
  const colors = TONE[tone];
  return (
    <Link
      to={to}
      className="group relative flex min-h-[6.75rem] items-center gap-3 overflow-hidden rounded-xl border border-line/90 bg-surface px-4 py-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop sm:gap-4 sm:px-5"
    >
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', colors.icon)}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-2">{label}</span>
        <span className={cn('mt-0.5 block text-[1.8rem] font-bold leading-none tracking-[-0.04em] tabular-nums', colors.value)}>{value}</span>
        <span className="mt-1 block truncate text-xs text-ink-3">{hint}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
      <span className={cn('absolute inset-x-0 bottom-0 h-0.5 opacity-70', colors.bar)} aria-hidden />
    </Link>
  );
};
