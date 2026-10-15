import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const SECTION_TITLE_TEXT = 'text-base font-semibold text-ink';

export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn('rounded-xl border border-line bg-surface shadow-card', className)}>{children}</section>
);

/** Group of fields with a section title (long forms: left column). */
export const FormSection = ({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) => (
  <Panel className={cn('p-4 sm:p-6', className)}>
    <h2 className={cn(description ? 'mb-1' : 'mb-3', SECTION_TITLE_TEXT)}>{title}</h2>
    {description ? <p className="mb-3 text-sm text-ink-2">{description}</p> : null}
    {children}
  </Panel>
);

interface AsideCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Side summary / guidance card (long forms: right column). */
export const AsideCard = ({ icon: Icon, title, action, children, className }: AsideCardProps) => (
  <Panel className={className}>
    <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
          <Icon className="size-4 text-accent" />
        </span>
        <h2 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h2>
      </span>
      {action}
    </header>
    {children ? <div className="px-5 pb-5 text-sm text-ink-2">{children}</div> : null}
  </Panel>
);
