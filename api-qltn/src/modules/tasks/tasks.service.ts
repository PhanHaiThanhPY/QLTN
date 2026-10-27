import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { vnDate } from '../../common/utils/vn-date';
import { AuditEvent, SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { RepairRecord } from '../records/entities/repair-record.entity';
import { RECORD_FINAL_STATUSES } from '../records/record-status-groups';
import { loadTaskFacts } from './task-facts';
import { COMPLETED_ACTIONS, REPAIR_TASK_KINDS, type RepairTaskKind } from './task-kinds';
import { tasksOfRecord, type RecordTask } from './task-rules';

/** BR-TK-06 / D-TK-4: completed tasks of the last 30 days. */
const DONE_DAYS = 30;
const DONE_LIMIT = 200;
const DAY_MS = 86_400_000;
const URGENT_PRIORITIES: readonly string[] = ['URGENT', 'HIGH'];

export interface TaskRecordView {
  id: string;
  code: string;
  title: string;
  buildingId: string;
  locationId: string | null;
  status: string;
  priority: string;
  /** The record went through the B06 emergency flow ("Xử lý khẩn cấp"). */
  isEmergency: boolean;
}

/** One open task of the viewer (BR-TK-05). */
export interface TaskView {
  id: string;
  kind: RepairTaskKind;
  label: string;
  /** Record tab that opens (web `TASK_KIND_TAB`). */
  tab: string;
  detail: string | null;
  dueAt: Date | null;
  isOverdue: boolean;
  startedAt: Date | null;
  record: TaskRecordView;
}

/** One task the viewer did in the last 30 days (BR-TK-06). */
export interface DoneTaskView {
  id: string;
  label: string;
  result: string;
  at: Date;
  record: Pick<TaskRecordView, 'id' | 'code' | 'title' | 'buildingId'>;
}

export interface MyTasksView {
  asOf: Date;
  /** Vietnam date of `asOf`, for "Hôm nay, dd/mm/yyyy" and "Đến hạn hôm nay". */
  today: string;
  open: TaskView[];
  done: DoneTaskView[];
  counts: { open: number; overdue: number; dueToday: number; done: number };
}

const toRecordView = (record: RepairRecord): TaskRecordView => ({
  id: record.id,
  code: record.code,
  title: record.title,
  buildingId: record.buildingId,
  locationId: record.locationId,
  status: record.status,
  priority: record.priority,
  isEmergency: Boolean(record.emergency),
});

/** BR-TK-07 groups: overdue, then urgent records, then tasks with a deadline, then the rest. */
const groupOf = (task: TaskView): number => {
  if (task.isOverdue) return 0;
  if (task.record.isEmergency || URGENT_PRIORITIES.includes(task.record.priority)) return 1;
  return task.dueAt ? 2 : 3;
};

const time = (date: Date | null, empty: number): number => (date ? date.getTime() : empty);

export const compareTasks = (a: TaskView, b: TaskView): number =>
  groupOf(a) - groupOf(b) ||
  time(a.dueAt, Number.MAX_SAFE_INTEGER) - time(b.dueAt, Number.MAX_SAFE_INTEGER) ||
  time(a.startedAt, Number.MAX_SAFE_INTEGER) - time(b.startedAt, Number.MAX_SAFE_INTEGER) ||
  a.record.code.localeCompare(b.record.code);

/** Whether the viewer receives a task: by person, by capability in the building (D-TK-2), or as admin (D-TK-5). */
const isMine = (actor: AuthenticatedUser, task: RecordTask): boolean => {
  const assignee = task.assignee;
  if ('userId' in assignee) return assignee.userId === actor.id;
  if ('capability' in assignee) return hasCapability(actor, assignee.capability);
  return actor.role === assignee.role;
};

/** "Công việc của tôi" for repair records (SPEC TK-S1): computed on every read, never stored (D-TK-1). */
@Injectable()
export class TasksService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async mine(actor: AuthenticatedUser, now = new Date()): Promise<MyTasksView> {
    const [open, done] = await Promise.all([this.openTasks(actor, now), this.doneTasks(actor, now)]);
    const today = vnDate(now);
    const overdue = open.filter((task) => task.isOverdue).length;
    const dueToday = open.filter((task) => !task.isOverdue && task.dueAt && vnDate(task.dueAt) === today).length;
    return { asOf: now, today, open, done, counts: { open: open.length, overdue, dueToday, done: done.length } };
  }

  /** BR-TK-01..03 over every open record of the viewer's buildings; nobody else's tasks are reachable (BR-TK-09). */
  private async openTasks(actor: AuthenticatedUser, now: Date): Promise<TaskView[]> {
    if (actor.buildingIds.length === 0) return [];
    const records = await this.dataSource.getRepository(RepairRecord).findBy({
      buildingId: In(actor.buildingIds),
      status: Not(In([...RECORD_FINAL_STATUSES, 'DRAFT'])),
    });
    const facts = await loadTaskFacts(this.dataSource, records);
    return records
      .flatMap((record) => {
        const recordFacts = facts.get(record.id);
        if (!recordFacts) return [];
        return tasksOfRecord(record, recordFacts)
          .filter((task) => isMine(actor, task))
          .map((task): TaskView => ({
            id: `${record.id}:${task.key}`,
            kind: task.kind,
            label: REPAIR_TASK_KINDS[task.kind].label,
            tab: REPAIR_TASK_KINDS[task.kind].tab,
            detail: task.detail,
            dueAt: task.dueAt,
            isOverdue: Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
            startedAt: task.startedAt,
            record: toRecordView(record),
          }));
      })
      .sort(compareTasks);
  }

  /** BR-TK-06: the viewer's own moves of the last 30 days, from the audit trail, newest first. */
  private async doneTasks(actor: AuthenticatedUser, now: Date): Promise<DoneTaskView[]> {
    if (actor.buildingIds.length === 0) return [];
    const rows = await this.dataSource
      .getRepository(AuditEvent)
      .createQueryBuilder('a')
      .innerJoin(RepairRecord, 'r', 'r.id = a.subject_id')
      .select(['a.id AS "id"', 'a.action AS "action"', 'a.created_at AS "at"'])
      .addSelect(['r.id AS "recordId"', 'r.code AS "code"', 'r.title AS "title"', 'r.building_id AS "buildingId"'])
      .where('a.subject_type = :type', { type: SUBJECT_TYPE.REPAIR_RECORD })
      .andWhere('a.actor_id = :actorId', { actorId: actor.id })
      .andWhere('a.action IN (:...actions)', { actions: Object.keys(COMPLETED_ACTIONS) })
      .andWhere('a.created_at >= :since', { since: new Date(now.getTime() - DONE_DAYS * DAY_MS) })
      .andWhere('r.building_id IN (:...buildings)', { buildings: actor.buildingIds })
      .orderBy('a.created_at', 'DESC')
      .limit(DONE_LIMIT)
      .getRawMany<{
        id: string;
        action: keyof typeof COMPLETED_ACTIONS;
        at: Date;
        recordId: string;
        code: string;
        title: string;
        buildingId: string;
      }>();
    return rows.flatMap((row) => {
      const done = COMPLETED_ACTIONS[row.action];
      return done
        ? [
            {
              id: row.id,
              label: done.task,
              result: done.result,
              at: new Date(row.at),
              record: { id: row.recordId, code: row.code, title: row.title, buildingId: row.buildingId },
            },
          ]
        : [];
    });
  }
}
