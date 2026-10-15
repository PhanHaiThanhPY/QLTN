import type { SubjectType } from '@/domain/constants';
import type { NotificationView } from '@/services/tasks-service';
import { matchesFilter, readFilter } from './notification-filters';

const view = (title: string, subjectType: SubjectType = 'REPAIR_RECORD', readAt?: string): NotificationView => ({
  notification: {
    id: title,
    subjectType,
    subjectId: 'subject-1',
    buildingId: 'building-a',
    recipientId: 'user-1',
    title,
    message: '',
    createdAt: '2026-10-12T08:00:00.000Z',
    readAt,
  },
  subjectCode: 'SC-001',
});

describe('notification filters', () => {
  it('accepts URL filter values case-insensitively and falls back safely', () => {
    expect(readFilter('unread')).toBe('UNREAD');
    expect(readFilter('MAINTENANCE')).toBe('MAINTENANCE');
    expect(readFilter('unknown')).toBe('ALL');
  });

  it('separates unread, overdue, approval and maintenance notifications', () => {
    expect(matchesFilter(view('Công việc quá hạn 1 ngày'), 'OVERDUE')).toBe(true);
    expect(matchesFilter(view('Hồ sơ chờ BQT duyệt'), 'APPROVAL')).toBe(true);
    expect(matchesFilter(view('Bảo trì định kỳ đến hạn', 'MAINTENANCE_OCCURRENCE'), 'MAINTENANCE')).toBe(true);
    expect(matchesFilter(view('Cập nhật đã đọc', 'REPAIR_RECORD', '2026-10-12T09:00:00.000Z'), 'UNREAD')).toBe(false);
  });
});
