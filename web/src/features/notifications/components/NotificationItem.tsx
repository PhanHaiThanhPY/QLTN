import { Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NotificationView } from '@/services/tasks-service';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/lib/cn';
import { SubjectTypeBadge } from '@/features/tasks/components/SubjectTypeBadge';

interface NotificationItemProps {
  view: NotificationView;
  buildingName: (id?: string) => string;
  isMarking: boolean;
  onOpen: (view: NotificationView) => void;
  onMarkRead: (view: NotificationView) => void;
}

/** One notification; unread rows are highlighted and can be marked read in place. */
export const NotificationItem = ({ view, buildingName, isMarking, onOpen, onMarkRead }: NotificationItemProps) => {
  const { notification } = view;
  const isUnread = !notification.readAt;
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3.5 py-3 sm:flex-row sm:items-start',
        isUnread ? 'border-accent/30 bg-accent-soft/40' : 'border-line bg-surface',
      )}
    >
      <button type="button" onClick={() => onOpen(view)} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          {isUnread ? (
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          ) : null}
          <SubjectTypeBadge subjectType={notification.subjectType} />
          {view.subjectCode ? <Tag>{view.subjectCode}</Tag> : null}
          {isUnread ? <span className="sr-only">Chưa đọc</span> : null}
        </span>
        <span className={cn('mt-1.5 block text-ink', isUnread ? 'font-semibold' : 'font-medium')}>{notification.title}</span>
        {notification.message ? <span className="mt-0.5 block break-words text-sm text-ink-2">{notification.message}</span> : null}
        <span className="mt-1 block text-xs text-ink-2">
          {formatDateTime(notification.createdAt)} · {buildingName(notification.buildingId)}
        </span>
      </button>
      {isUnread ? (
        <Button variant="secondary" size="sm" className="self-start" isLoading={isMarking} onClick={() => onMarkRead(view)}>
          Đánh dấu đã đọc
        </Button>
      ) : null}
    </li>
  );
};
