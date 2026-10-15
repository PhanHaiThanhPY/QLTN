import { NOTIFICATION_KIND, SUBJECT_TYPE_LABEL, TASK_KIND_LABEL } from '@/domain/constants';
import { asRecord } from '@/domain/validation';
import type { Notification, Task } from '@/domain/types';
import type { CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const subjectLabel = async (ctx: CommandContext, task: Task): Promise<string> => {
  if (task.subjectType === 'REPAIR_RECORD') {
    const record = await ctx.db.records.get(task.subjectId);
    return record ? `${record.code} – ${record.title}` : task.subjectId;
  }
  if (task.subjectType === 'MAINTENANCE_OCCURRENCE') {
    const occurrence = await ctx.db.occurrences.get(task.subjectId);
    return occurrence?.code ?? task.subjectId;
  }
  return task.subjectId;
};

const formatDueAt = (value: string): string =>
  new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

/** Creates one in-app reminder per task deadline; repeated runs remain idempotent. */
const syncDueNotifications: CommandHandler = async (ctx, command) => {
  if (!ctx.isSystem) throw new Error('Due notifications must run as SYSTEM.');
  const payload = asRecord(command.payload);
  const buildingIds = Array.isArray(payload.buildingIds)
    ? payload.buildingIds.filter((value): value is string => typeof value === 'string')
    : [];
  if (buildingIds.length === 0) return { ok: true, data: { created: 0, overdue: 0, dueSoon: 0 } };

  const nowMs = new Date(ctx.now).getTime();
  const reminderLimit = nowMs + REMINDER_WINDOW_MS;
  const tasks = await ctx.db.tasks
    .where('buildingId')
    .anyOf(buildingIds)
    .filter((task) => task.status === 'OPEN' && Boolean(task.dueAt))
    .toArray();
  let created = 0;
  let overdue = 0;
  let dueSoon = 0;

  for (const task of tasks) {
    const dueMs = new Date(task.dueAt as string).getTime();
    const isOverdue = dueMs <= nowMs;
    const isDueSoon = !isOverdue && dueMs <= reminderLimit;
    if (!isOverdue && !isDueSoon) continue;

    const kind = isOverdue ? NOTIFICATION_KIND.TASK_OVERDUE : NOTIFICATION_KIND.TASK_DUE_SOON;
    const eventKey = `task-reminder:${kind}:${task.id}:${task.dueAt}`;
    const exists = await ctx.db.notifications.where('eventKey').equals(eventKey).first();
    if (exists) continue;

    const label = await subjectLabel(ctx, task);
    const notification: Notification = {
      id: newId('ntf'),
      subjectType: task.subjectType,
      subjectId: task.subjectId,
      buildingId: task.buildingId,
      recipientId: task.assigneeId,
      title: `${isOverdue ? 'Đã quá hạn' : 'Sắp đến hạn'}: ${TASK_KIND_LABEL[task.kind]}`,
      message: `${SUBJECT_TYPE_LABEL[task.subjectType]} ${label} · Hạn xử lý ${formatDueAt(task.dueAt as string)}.`,
      createdAt: ctx.now,
      kind,
      eventKey,
      dueAt: task.dueAt,
    };
    await ctx.db.notifications.add(notification);
    created += 1;
    if (isOverdue) overdue += 1;
    else dueSoon += 1;
  }

  return { ok: true, data: { created, overdue, dueSoon } };
};

export const notificationHandlers: Record<string, CommandHandler> = { syncDueNotifications };
