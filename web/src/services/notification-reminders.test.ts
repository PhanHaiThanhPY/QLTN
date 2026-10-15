import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KIND } from '@/domain/constants';
import { executeSystemCommand } from './command-engine';
import { getDb } from '@/storage/db';
import { newId, setFixedNow } from './runtime';
import { seedAt } from '@/test/helpers';

describe('due notification reminders', () => {
  it('creates one overdue reminder and does not duplicate it on a retry', async () => {
    await seedAt();
    const db = getDb();
    const task = await db.tasks.filter((row) => row.status === 'OPEN' && Boolean(row.dueAt)).first();
    expect(task?.dueAt).toBeTruthy();
    if (!task?.dueAt) return;

    setFixedNow(new Date(new Date(task.dueAt).getTime() + 60_000));
    const command = () => executeSystemCommand({
      commandId: newId('cmd'),
      subjectType: 'BUILDING',
      action: 'syncDueNotifications',
      payload: { buildingIds: [task.buildingId] },
    });
    await command();
    await command();

    const reminders = await db.notifications
      .where('recipientId')
      .equals(task.assigneeId)
      .filter((row) => row.kind === NOTIFICATION_KIND.TASK_OVERDUE && row.eventKey?.includes(task.id) === true)
      .toArray();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.dueAt).toBe(task.dueAt);
  });

  it('creates a due soon reminder inside the 24-hour window', async () => {
    await seedAt();
    const db = getDb();
    const task = await db.tasks.filter((row) => row.status === 'OPEN' && Boolean(row.dueAt)).first();
    expect(task?.dueAt).toBeTruthy();
    if (!task?.dueAt) return;

    setFixedNow(new Date(new Date(task.dueAt).getTime() - 12 * 60 * 60 * 1000));
    await executeSystemCommand({
      commandId: newId('cmd'),
      subjectType: 'BUILDING',
      action: 'syncDueNotifications',
      payload: { buildingIds: [task.buildingId] },
    });

    const reminder = await db.notifications
      .where('recipientId')
      .equals(task.assigneeId)
      .filter((row) => row.kind === NOTIFICATION_KIND.TASK_DUE_SOON && row.eventKey?.includes(task.id) === true)
      .first();
    expect(reminder?.title).toContain('Sắp đến hạn');
  });
});
