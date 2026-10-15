import { useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { SubjectTypeBadge } from '@/features/tasks/components/SubjectTypeBadge';
import { useCommand } from '@/hooks/useCommand';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { countUnreadNotifications, getNotifications } from '@/services/tasks-service';
import type { NotificationView } from '@/services/tasks-service';
import { subjectPath } from '@/utils/subject-link';
import { formatDateTime } from '@/utils/date';

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useServiceQuery(['notifications', 'unread'], countUnreadNotifications);
  const preview = useServiceQuery(['notifications', 'preview'], getNotifications, open);
  const markRead = useCommand();
  const count = unread.data ?? 0;

  const openNotification = async (view: NotificationView) => {
    if (!view.notification.readAt) {
      await markRead.execute({ subjectType: 'REPAIR_RECORD', action: 'markNotificationRead', payload: { notificationIds: [view.notification.id] } });
    }
    setOpen(false);
    navigate(subjectPath(view.notification.subjectType, view.notification.subjectId));
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
        aria-label={`Thông báo, ${count} chưa đọc`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-[18px]" />
        {count > 0 ? <span className="tnum absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-bg bg-accent px-1 text-center text-2xs font-bold leading-4 text-accent-fg">{count > 99 ? '99+' : count}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop" role="dialog" aria-label="Thông báo mới">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Thông báo mới</p>
              <p className="mt-0.5 text-xs text-ink-2">{count} thông báo chưa đọc</p>
            </div>
            <Link to="/notifications" className="text-xs font-semibold text-accent hover:underline" onClick={() => setOpen(false)}>Xem tất cả</Link>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {preview.isLoading ? <p className="px-2 py-5 text-center text-sm text-ink-2">Đang tải thông báo...</p> : null}
            {!preview.isLoading && preview.data?.length === 0 ? <p className="px-2 py-5 text-center text-sm text-ink-2">Chưa có thông báo mới.</p> : null}
            {preview.data?.slice(0, 4).map((view) => (
              <button key={view.notification.id} type="button" className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left hover:bg-surface-2" onClick={() => void openNotification(view)}>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${view.notification.readAt ? 'bg-line-2' : 'bg-accent'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5"><SubjectTypeBadge subjectType={view.notification.subjectType} />{view.subjectCode ? <span className="text-2xs font-semibold text-ink-3">{view.subjectCode}</span> : null}</span>
                  <span className={`mt-1 block truncate text-xs ${view.notification.readAt ? 'font-medium' : 'font-semibold'} text-ink`}>{view.notification.title}</span>
                  <span className="mt-0.5 block text-2xs text-ink-3">{formatDateTime(view.notification.createdAt)}</span>
                </span>
                <ChevronRight className="mt-3 size-3.5 shrink-0 text-ink-3" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
