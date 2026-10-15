import type { ReactNode } from 'react';
import { AlertTriangle, Info, UserX } from 'lucide-react';
import { cn } from '@/lib/cn';

type NoticeTone = 'info' | 'warning' | 'danger';

const TONE_CLASS: Record<NoticeTone, string> = {
  info: 'border-info/20 bg-info-soft text-info',
  warning: 'border-warn/35 bg-warn-soft text-warn',
  danger: 'border-crit/35 bg-crit-soft text-crit',
};

const TONE_ICON = { info: Info, warning: AlertTriangle, danger: UserX } as const;

interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const Notice = ({ tone = 'info', title, children, className }: NoticeProps) => {
  const Icon = TONE_ICON[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', TONE_CLASS[tone], className)} role="status">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
    </div>
  );
};
