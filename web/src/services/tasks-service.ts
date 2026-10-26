import { IS_API_MODE } from '@/config/data-source';
import { TASK_KIND_TAB } from '@/domain/constants';
import type { Notification, Task } from '@/domain/types';
import { getDb } from '@/storage/db';
import { countApiUnreadNotifications, listApiNotifications } from './http/notifications-api';
import { now } from './runtime';
import { requireViewer } from './viewer';

export interface TaskView {
  task: Task;
  subjectCode: string;
  subjectTitle: string;
  tab: string;
  isOverdue: boolean;
}

/** Resolves display code/title for a task or notification subject. */
const subjectLabels = async (rows: { subjectType: string; subjectId: string }[]): Promise<Map<string, { code: string; title: string }>> => {
  const db = getDb();
  const ids = (type: string) => [...new Set(rows.filter((row) => row.subjectType === type).map((row) => row.subjectId))];
  const [records, occurrences, plans, items] = await Promise.all([
    db.records.bulkGet(ids('REPAIR_RECORD')),
    db.occurrences.bulkGet(ids('MAINTENANCE_OCCURRENCE')),
    db.maintenancePlans.bulkGet(ids('MAINTENANCE_PLAN')),
    db.maintenanceItems.bulkGet(ids('MAINTENANCE_ITEM')),
  ]);
  const itemRows = await db.maintenanceItems.bulkGet(occurrences.map((row) => row?.itemId ?? ''));
  const labels = new Map<string, { code: string; title: string }>();
  records.forEach((row) => row && labels.set(row.id, { code: row.code, title: row.title }));
  occurrences.forEach((row, index) => row && labels.set(row.id, { code: row.code, title: itemRows[index]?.name ?? '' }));
  plans.forEach((row) => row && labels.set(row.id, { code: row.code, title: row.title }));
  items.forEach((row) => row && labels.set(row.id, { code: row.code, title: row.name }));
  return labels;
};

/** OPEN tasks assigned to the viewer inside their buildings ("Công việc chờ tôi"). */
export const getMyTasks = async (includeDone = false): Promise<TaskView[]> => {
  const viewer = await requireViewer();
  const rows = await getDb()
    .tasks.where('assigneeId')
    .equals(viewer.id)
    .filter((task) => viewer.buildingIds.includes(task.buildingId) && (includeDone || task.status === 'OPEN'))
    .toArray();
  const labels = await subjectLabels(rows);
  const at = now();
  return rows
    .map((task) => ({
      task,
      subjectCode: labels.get(task.subjectId)?.code ?? '',
      subjectTitle: labels.get(task.subjectId)?.title ?? '',
      tab: TASK_KIND_TAB[task.kind],
      isOverdue: task.status === 'OPEN' && Boolean(task.dueAt) && new Date(task.dueAt as string) < at,
    }))
    .sort((a, b) => (a.task.dueAt ?? '9999').localeCompare(b.task.dueAt ?? '9999'));
};

export interface NotificationView {
  notification: Notification;
  subjectCode: string;
}

export const getNotifications = async (): Promise<NotificationView[]> => {
  const viewer = await requireViewer();
  if (IS_API_MODE) return listApiNotifications(viewer.id);
  const rows = await getDb()
    .notifications.where('recipientId')
    .equals(viewer.id)
    .filter((row) => viewer.buildingIds.includes(row.buildingId))
    .toArray();
  const labels = await subjectLabels(rows);
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((notification) => ({ notification, subjectCode: labels.get(notification.subjectId)?.code ?? '' }));
};

export const countUnreadNotifications = async (): Promise<number> => {
  if (IS_API_MODE) return countApiUnreadNotifications();
  const viewer = await requireViewer();
  return getDb()
    .notifications.where('recipientId')
    .equals(viewer.id)
    .filter((row) => !row.readAt && viewer.buildingIds.includes(row.buildingId))
    .count();
};
