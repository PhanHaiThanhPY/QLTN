import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getNotifications } from '@/services/tasks-service';
import type { NotificationView } from '@/services/tasks-service';
import { browserNotificationPermission, browserNotificationsEnabled, notifyBrowser, requestBrowserNotificationPermission } from '@/services/browser-notifications';
import { subjectPath } from '@/utils/subject-link';
import { NotificationItem } from './components/NotificationItem';
import { NotificationTable } from './components/NotificationTable';
import { FILTER_OPTIONS, matchesFilter, readFilter } from './notification-filters';
import type { NotificationFilter } from './notification-filters';

/** Notifications of the current account, newest first. */
const NotificationsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { buildingName } = useReferenceData();
  const query = useServiceQuery(['notifications', 'list'], getNotifications);
  const markOne = useCommand();
  const markAll = useCommand({ successMessage: 'Đã đánh dấu tất cả là đã đọc.' });
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState(browserNotificationPermission);
  const knownIds = useRef<Set<string> | null>(null);

  const rows = query.data ?? [];
  const filter = readFilter(searchParams.get('filter'));
  const unreadIds = rows.filter((row) => !row.notification.readAt).map((row) => row.notification.id);
  const filteredRows = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [filter, rows]);

  const counts: Record<NotificationFilter, number> = {
    ALL: rows.length,
    UNREAD: rows.filter((row) => !row.notification.readAt).length,
    OVERDUE: rows.filter((row) => matchesFilter(row, 'OVERDUE')).length,
    APPROVAL: rows.filter((row) => matchesFilter(row, 'APPROVAL')).length,
    MAINTENANCE: rows.filter((row) => matchesFilter(row, 'MAINTENANCE')).length,
  };

  useEffect(() => {
    if (rows.length === 0) return;
    const currentIds = new Set(rows.map((row) => row.notification.id));
    if (knownIds.current) {
      rows.filter((row) => !knownIds.current?.has(row.notification.id) && !row.notification.readAt).forEach((row) => notifyBrowser(row.notification));
    }
    knownIds.current = currentIds;
  }, [rows]);

  // subjectType is required by the command type but ignored by markNotificationRead.
  const markRead = (notificationIds: string[]) =>
    markOne.execute({ subjectType: 'REPAIR_RECORD', action: 'markNotificationRead', payload: { notificationIds } });

  const handleMarkRead = async (view: NotificationView) => {
    setMarkingId(view.notification.id);
    try {
      await markRead([view.notification.id]);
    } finally {
      setMarkingId(null);
    }
  };

  const handleOpen = async (view: NotificationView) => {
    const { notification } = view;
    if (!notification.readAt) await markRead([notification.id]);
    navigate(subjectPath(notification.subjectType, notification.subjectId));
  };

  const handleMarkAll = async () => {
    if (unreadIds.length === 0) return;
    await markAll.execute({ subjectType: 'REPAIR_RECORD', action: 'markNotificationRead', payload: { notificationIds: unreadIds } });
  };

  const enableBrowserNotifications = async () => {
    try {
      const permission = await requestBrowserNotificationPermission();
      setBrowserPermission(permission);
    } catch (error) {
      console.error('Request browser notification permission failed:', error);
    }
  };

  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) {
      return <EmptyState title="Chưa có thông báo" description="Thông báo về hồ sơ sửa chữa và lượt bảo trì liên quan đến bạn sẽ hiện ở đây." />;
    }
    if (filteredRows.length === 0) return <EmptyState title="Không có thông báo phù hợp" description="Thử chọn bộ lọc khác để xem các cập nhật trong phạm vi của bạn." />;
    return (
      <>
        <NotificationTable
          rows={filteredRows}
          buildingName={buildingName}
          markingId={markingId}
          onOpen={(item) => void handleOpen(item)}
          onMarkRead={(item) => void handleMarkRead(item)}
        />
        <ul className="space-y-1.5 md:hidden">
          {filteredRows.map((view) => (
            <NotificationItem
              key={view.notification.id}
              view={view}
              buildingName={buildingName}
              isMarking={markingId === view.notification.id}
              onOpen={(item) => void handleOpen(item)}
              onMarkRead={(item) => void handleMarkRead(item)}
            />
          ))}
        </ul>
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Thông báo"
        description="Thông báo theo người nhận; hỗ trợ trong ứng dụng và trình duyệt."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            {browserPermission === 'default' ? (
              <Button variant="secondary" onClick={() => void enableBrowserNotifications()}><Bell className="h-4 w-4" />Bật thông báo trình duyệt</Button>
            ) : null}
            <Button variant="secondary" isLoading={markAll.isPending} disabled={unreadIds.length === 0} onClick={() => void handleMarkAll()}>
              <CheckCheck className="h-4 w-4" />
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        }
      />
      <p className="mb-4 text-sm text-ink-2">
        <span className="tnum font-medium text-ink">{unreadIds.length}</span> thông báo chưa đọc. {browserNotificationsEnabled() ? 'Đã bật thông báo trình duyệt.' : 'Email, Zalo và SMS chưa được kết nối.'}
      </p>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Lọc thông báo">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return <button key={option.value} type="button" role="tab" aria-selected={active} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${active ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-ink-2 hover:border-line-2 hover:bg-surface-2'}`} onClick={() => { const next = new URLSearchParams(searchParams); if (option.value === 'ALL') next.delete('filter'); else next.set('filter', option.value.toLowerCase()); setSearchParams(next); }}>{option.label}<span className="rounded-full bg-black/10 px-1.5 py-0.5 text-2xs tabular-nums dark:bg-white/10">{counts[option.value]}</span></button>;
        })}
      </div>
      {renderBody()}
    </div>
  );
};

export default NotificationsPage;
