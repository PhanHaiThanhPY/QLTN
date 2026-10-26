import type { Notification } from '@/domain/types';
import type { NotificationView } from '../tasks-service';
import { apiList, apiRequest } from './client';

/** One row of `GET /notifications` (SPEC B03–B09 v2 BR-S3-01a). */
export interface ApiNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  subjectType: string;
  subjectId: string;
  buildingId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The API sends plain notices (e.g. a construction plan); the demo's task reminders have no API kind yet. */
const toView = (row: ApiNotification, recipientId: string): NotificationView => {
  const notification: Notification = {
    id: row.id,
    subjectType: row.subjectType as Notification['subjectType'],
    subjectId: row.subjectId,
    buildingId: row.buildingId ?? '',
    recipientId,
    title: row.title,
    message: row.body,
    createdAt: row.createdAt,
    ...(row.readAt ? { readAt: row.readAt } : {}),
  };
  return { notification, subjectCode: '' };
};

const PAGE_LIMIT = 100;

/** The caller's latest 100 notifications, newest first. */
export const listApiNotifications = async (recipientId: string): Promise<NotificationView[]> => {
  const result = await apiList<ApiNotification>('GET', '/notifications', { query: { page: 1, limit: PAGE_LIMIT } });
  return result.data.map((row) => toView(row, recipientId));
};

export const countApiUnreadNotifications = async (): Promise<number> =>
  (await apiRequest<{ unread: number }>('GET', '/notifications/unread-count')).unread;

/** Marks each id read, one request per id (the minimum API has no bulk route). */
export const markApiNotificationsRead = async (ids: readonly string[]): Promise<void> => {
  for (const id of ids) {
    await apiRequest<ApiNotification>('POST', `/notifications/${encodeURIComponent(id)}/read`, { body: {} });
  }
};
