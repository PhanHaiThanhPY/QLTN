import type { NotificationView } from '@/services/tasks-service';

export type NotificationFilter = 'ALL' | 'UNREAD' | 'OVERDUE' | 'APPROVAL' | 'MAINTENANCE';

export const FILTER_OPTIONS: readonly { value: NotificationFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'UNREAD', label: 'Chưa đọc' },
  { value: 'OVERDUE', label: 'Quá hạn' },
  { value: 'APPROVAL', label: 'Phê duyệt' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
];

export const readFilter = (value: string | null): NotificationFilter => {
  const allowed = FILTER_OPTIONS.map((option) => option.value);
  const normalized = value?.toUpperCase();
  return allowed.includes(normalized as NotificationFilter) ? (normalized as NotificationFilter) : 'ALL';
};

const normalizedText = (view: NotificationView): string => `${view.notification.title} ${view.notification.message}`.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const matchesFilter = (view: NotificationView, filter: NotificationFilter): boolean => {
  if (filter === 'ALL') return true;
  if (filter === 'UNREAD') return !view.notification.readAt;
  const text = normalizedText(view);
  if (filter === 'OVERDUE') return text.includes('qua han') || text.includes('tre han');
  if (filter === 'APPROVAL') return view.notification.subjectType === 'REPAIR_RECORD' && (text.includes('duyet') || text.includes('phe duyet') || text.includes('xac nhan'));
  return view.notification.subjectType === 'MAINTENANCE_OCCURRENCE' || view.notification.subjectType === 'MAINTENANCE_PLAN' || view.notification.subjectType === 'MAINTENANCE_ITEM' || text.includes('bao tri');
};
