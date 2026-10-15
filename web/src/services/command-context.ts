import { NOTIFICATION_KIND, SUBJECT_TYPE_LABEL, TASK_DUE_DAYS, TASK_KIND_LABEL } from '@/domain/constants';
import type { NotificationKind, SubjectType, TaskKind } from '@/domain/constants';
import { forbidden, notFound, conflict } from '@/domain/errors';
import { canAccessLocation } from '@/domain/permissions';
import type { DesiredTask } from '@/domain/task-rules';
import type { AssignmentRule, AuditEvent, IsoDateTime, Notification, Task, TaskCompletionReason, User } from '@/domain/types';
import type { DemoDatabase } from '@/storage/db';
import { newId } from './runtime';

export interface CommandContext {
  db: DemoDatabase;
  actor: User;
  isSystem: boolean;
  triggeredBy?: string;
  commandId: string;
  now: IsoDateTime;
  today: string;
  usersById: Map<string, User>;
  assignmentRulesByBuilding: Map<string, AssignmentRule[]>;
}

interface SubjectRef {
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string;
}

export interface AuditInput extends SubjectRef {
  action: string;
  fromStatus?: string;
  toStatus?: string;
  entityVersion: number;
  reason?: string;
}

export const writeAudit = async (ctx: CommandContext, input: AuditInput): Promise<void> => {
  const event: AuditEvent = {
    id: newId('aud'),
    commandId: ctx.commandId,
    actorId: ctx.actor.id,
    triggeredBy: ctx.triggeredBy,
    createdAt: ctx.now,
    ...input,
  };
  await ctx.db.auditEvents.add(event);
};

export interface NotifyInput extends SubjectRef {
  recipientId: string;
  title: string;
  message: string;
  kind?: NotificationKind;
  eventKey?: string;
  dueAt?: IsoDateTime;
}

export const notify = async (ctx: CommandContext, input: NotifyInput): Promise<void> => {
  if (input.recipientId === ctx.actor.id) return;
  const row: Notification = { id: newId('ntf'), createdAt: ctx.now, kind: input.kind ?? NOTIFICATION_KIND.WORK_ASSIGNED, ...input };
  await ctx.db.notifications.add(row);
};

/** Due time for a task kind from the record's configuration snapshot, else the defaults (not a customer SLA). */
export const dueAtFor = (ctx: CommandContext, kind: TaskKind, dueDays?: Partial<Record<TaskKind, number>>): IsoDateTime | undefined => {
  const days = dueDays?.[kind] ?? TASK_DUE_DAYS[kind];
  if (days === undefined) return undefined;
  return new Date(new Date(ctx.now).getTime() + days * 86_400_000).toISOString();
};

export interface SyncTaskInput extends SubjectRef {
  desired: DesiredTask[];
  dueAt?: IsoDateTime;
  /** Reason used when closing tasks that no longer match. */
  closeReason?: TaskCompletionReason;
  subjectLabel: string;
}

/**
 * Keeps exactly one OPEN task per desired step (kind + assignee) on the subject.
 * Closes stale tasks, opens missing ones and notifies their assignees.
 */
export const syncTasks = async (ctx: CommandContext, input: SyncTaskInput): Promise<void> => {
  const { desired } = input;
  const open = await ctx.db.tasks
    .where('[subjectType+subjectId]')
    .equals([input.subjectType, input.subjectId])
    .filter((task) => task.status === 'OPEN')
    .toArray();

  const keyOf = (task: Pick<Task, 'kind' | 'assigneeId'>): string => `${task.kind}|${task.assigneeId}`;
  const wanted = new Set(desired.map(keyOf));
  const kept = new Set<string>();
  for (const task of open) {
    const key = keyOf(task);
    if (wanted.has(key) && !kept.has(key)) {
      kept.add(key);
      // A missing due time means "unchanged", never "clear the deadline" of a task that stays open.
      if (input.dueAt !== undefined && task.dueAt !== input.dueAt) await ctx.db.tasks.update(task.id, { dueAt: input.dueAt });
      continue;
    }
    await ctx.db.tasks.update(task.id, {
      status: 'DONE',
      completedAt: ctx.now,
      completionReason: input.closeReason ?? (desired.length > 0 ? 'COMPLETED' : 'CLOSED'),
    });
  }

  for (const target of desired) {
    if (kept.has(keyOf(target))) continue;
    kept.add(keyOf(target));
    const task: Task = {
      id: newId('tsk'),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      buildingId: input.buildingId,
      assigneeId: target.assigneeId,
      kind: target.kind,
      status: 'OPEN',
      dueAt: input.dueAt,
      createdAt: ctx.now,
    };
    await ctx.db.tasks.add(task);
    await notify(ctx, {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      buildingId: input.buildingId,
      recipientId: target.assigneeId,
      title: `Việc mới: ${TASK_KIND_LABEL[target.kind]}`,
      message: `${SUBJECT_TYPE_LABEL[input.subjectType]} ${input.subjectLabel}`,
      kind: NOTIFICATION_KIND.WORK_ASSIGNED,
      eventKey: `task-assigned:${task.id}`,
      dueAt: task.dueAt,
    });
  }
};

/** Scope check first (out-of-scope looks like not found), then optimistic version check. */
export const assertScopeAndVersion = (
  ctx: CommandContext,
  entity: { buildingId: string; version: number } | undefined,
  expectedVersion: number | undefined,
): void => {
  if (!entity) throw notFound();
  if (!ctx.isSystem && !ctx.actor.buildingIds.includes(entity.buildingId)) throw notFound();
  if (expectedVersion === undefined) throw conflict('Thiếu phiên bản dữ liệu (expectedVersion). Vui lòng tải lại.');
  if (entity.version !== expectedVersion) throw conflict();
};

export const assertBuildingScope = (ctx: CommandContext, buildingId: string): void => {
  if (!ctx.actor.buildingIds.includes(buildingId)) throw forbidden('Ngoài phạm vi tòa nhà của bạn.');
};

/**
 * Location scope inside an in-scope building (same convention as loadOccurrenceFor: forbidden, since the
 * building itself is visible). A missing location or an unrestricted user passes; SYSTEM is never limited.
 */
export const assertLocationScope = (ctx: CommandContext, buildingId: string, locationId: string | undefined): void => {
  if (ctx.isSystem) return;
  if (!canAccessLocation(ctx.actor, buildingId, locationId)) throw forbidden('Ngoài phạm vi khu vực của bạn.');
};

export const bumpVersion = <T extends { version: number; updatedAt: IsoDateTime }>(ctx: CommandContext, entity: T): T => ({
  ...entity,
  version: entity.version + 1,
  updatedAt: ctx.now,
});

/** Next display code like SC-016 using a counter in the meta table. */
export const nextCode = async (ctx: CommandContext, prefix: string, width = 3): Promise<string> => {
  const key = `counter:${prefix}`;
  const row = await ctx.db.meta.get(key);
  const value = (typeof row?.value === 'number' ? row.value : 0) + 1;
  await ctx.db.meta.put({ key, value });
  return `${prefix}-${String(value).padStart(width, '0')}`;
};
