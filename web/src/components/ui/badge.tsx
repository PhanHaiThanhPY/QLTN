import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const NEUTRAL = 'border-transparent bg-surface-3 text-ink-2';
const ACCENT = 'border-transparent bg-accent-soft text-accent-strong dark:text-accent';
const INFO = 'border-transparent bg-info-soft text-info';
const GOOD = 'border-transparent bg-good-soft text-good';
const WARN = 'border-transparent bg-warn-soft text-warn';
const CRIT = 'border-transparent bg-crit-soft text-crit';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      neutral: NEUTRAL,
      accent: ACCENT,
      info: INFO,
      good: GOOD,
      warn: WARN,
      crit: CRIT,
      // Legacy names.
      primary: ACCENT,
      success: GOOD,
      warning: WARN,
      danger: CRIT,
      outline: 'border-line-2 bg-transparent text-ink-3',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  title?: string;
}

export const Badge = ({ tone, className, children, title }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} title={title}>
    {children}
  </span>
);

export type StatusTone = 'good' | 'warn' | 'crit' | 'accent' | 'info' | 'neutral';

const DOT: Record<StatusTone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  crit: 'bg-crit',
  accent: 'bg-accent',
  info: 'bg-info',
  neutral: 'bg-ink-3',
};

/** Record status: colour + dot + label, never colour alone. */
export const StatusPill = ({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) => (
  <Badge tone={tone}>
    <span className={cn('size-1.5 rounded-full', DOT[tone])} aria-hidden />
    {children}
  </Badge>
);

/** Code tag, e.g. SC-001, BT-003. */
export const Tag = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-lg bg-navy px-2 py-1 text-2xs font-semibold tracking-wide text-navy-ink', className)}>
    {children}
  </span>
);
