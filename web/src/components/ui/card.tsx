import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  // A table frame nested in a card drops its own border so there is no double outline.
  <div
    className={cn(
      'rounded-xl border border-line/90 bg-surface shadow-card [&_.table-frame]:shadow-none',
      className,
    )}
    {...props}
  />
);

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, description, actions, className }: CardHeaderProps) => (
  <div className={cn('card-header flex flex-wrap items-start justify-between gap-2.5 px-4 pb-3 pt-4 sm:px-5 sm:pt-5', className)}>
    <div className="min-w-0">
      <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {description ? <div className="mt-0.5 text-[0.8125rem] leading-5 text-ink-2">{description}</div> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export const CardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  // Full padding when used alone (e.g. filter panels); no top padding right after a CardHeader.
  <div className={cn('p-4 sm:p-5 [.card-header+&]:pt-0', className)} {...props} />
);
