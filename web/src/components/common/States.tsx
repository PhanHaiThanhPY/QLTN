import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isAppError, toErrorMessage } from '@/domain/errors';
import { cn } from '@/lib/cn';

/** Skeleton rows shaped like the content (no page spinner). */
export const LoadingState = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-2.5 rounded-lg border border-line bg-surface p-4 shadow-card" aria-busy="true" aria-label="Đang tải">
    <Skeleton className="h-5 w-1/3" />
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} className="h-10 w-full" />
    ))}
  </div>
);

interface StateFrameProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'empty' | 'error';
}

const StateFrame = ({ icon: Icon, title, description, action, tone = 'empty' }: StateFrameProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-2 bg-surface px-6 py-12 text-center">
    <div className={cn('flex size-11 items-center justify-center rounded-full', tone === 'error' ? 'bg-crit-soft text-crit' : 'bg-surface-3 text-ink-3')}>
      <Icon className="size-5" aria-hidden />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <div className="mx-auto max-w-sm text-sm text-ink-2">{description}</div> : null}
    </div>
    {action}
  </div>
);

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}

/** Says why it is empty and what to do next. */
export const EmptyState = ({ title, description, action, icon = Inbox }: EmptyStateProps) => (
  <StateFrame icon={icon} title={title} description={description} action={action} />
);

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** "No permission / not found" is shown separately from technical errors. */
export const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const isAccess = isAppError(error) && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN');
  return (
    <StateFrame
      icon={isAccess ? Lock : AlertTriangle}
      tone={isAccess ? 'empty' : 'error'}
      title={isAccess ? 'Không có quyền truy cập' : 'Không tải được dữ liệu'}
      description={toErrorMessage(error)}
      action={
        onRetry && !isAccess ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        ) : null
      }
    />
  );
};
