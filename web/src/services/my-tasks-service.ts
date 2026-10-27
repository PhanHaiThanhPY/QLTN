import { IS_API_MODE } from '@/config/data-source';
import { PRIORITY, TASK_KIND_LABEL } from '@/domain/constants';
import type { Priority, RepairStatus, SubjectType } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import { getDb } from '@/storage/db';
import { subjectPath } from '@/utils/subject-link';
import { apiRequest } from './http/client';
import { repairStatusOf } from './http/mappers';
import { todayVn } from './runtime';
import { getMyTasks } from './tasks-service';
import type { TaskView } from './tasks-service';

/** One open task of "Công việc của tôi", the same shape in api and mock mode (SPEC TK-S1 BR-TK-05). */
export interface MyTaskRow {
  id: string;
  label: string;
  /** Record (or occurrence) tab the task opens. */
  href: string;
  subjectType: SubjectType;
  code: string;
  title: string;
  buildingId: string;
  locationId?: string;
  status?: RepairStatus;
  priority?: Priority;
  /** The record went through the B06 emergency flow. */
  isEmergency: boolean;
  /** "Cần phân công lại": the blocked steps and their holders. */
  detail?: string;
  dueAt?: string;
  isOverdue: boolean;
  startedAt?: string;
}

/** One task done in the last 30 days (BR-TK-06). */
export interface MyDoneRow {
  id: string;
  label: string;
  result: string;
  at: string;
  href: string;
  code: string;
  title: string;
  buildingId: string;
}

export interface MyTaskBoard {
  /** Vietnam date of the read, for "Hôm nay, dd/mm/yyyy" and "Đến hạn hôm nay" (TD-01, TD-02). */
  today: IsoDate;
  open: MyTaskRow[];
  done: MyDoneRow[];
}

interface ApiTaskRecord {
  id: string;
  code: string;
  title: string;
  buildingId: string;
  locationId: string | null;
  status: string;
  priority: string;
  isEmergency: boolean;
}

interface ApiMyTasks {
  today: IsoDate;
  open: Array<{
    id: string;
    label: string;
    tab: string;
    detail: string | null;
    dueAt: string | null;
    isOverdue: boolean;
    startedAt: string | null;
    record: ApiTaskRecord;
  }>;
  done: Array<{ id: string; label: string; result: string; at: string; record: Pick<ApiTaskRecord, 'id' | 'code' | 'title' | 'buildingId'> }>;
}

const PRIORITIES = new Set<string>(Object.values(PRIORITY));
const priorityOf = (value: string): Priority | undefined => (PRIORITIES.has(value) ? (value as Priority) : undefined);
const DONE_DAYS_MS = 30 * 86_400_000;

/** `GET /me/tasks`: tasks are computed by the API (sorted by BR-TK-07) and always the caller's own. */
const apiBoard = async (): Promise<MyTaskBoard> => {
  const body = await apiRequest<ApiMyTasks>('GET', '/me/tasks');
  return {
    today: body.today,
    open: body.open.map((row) => ({
      id: row.id,
      label: row.label,
      href: subjectPath('REPAIR_RECORD', row.record.id, row.tab),
      subjectType: 'REPAIR_RECORD',
      code: row.record.code,
      title: row.record.title,
      buildingId: row.record.buildingId,
      ...(row.record.locationId ? { locationId: row.record.locationId } : {}),
      status: repairStatusOf(row.record.status),
      priority: priorityOf(row.record.priority),
      isEmergency: row.record.isEmergency,
      ...(row.detail ? { detail: row.detail } : {}),
      ...(row.dueAt ? { dueAt: row.dueAt } : {}),
      isOverdue: row.isOverdue,
      ...(row.startedAt ? { startedAt: row.startedAt } : {}),
    })),
    done: body.done.map((row) => ({
      id: row.id,
      label: row.label,
      result: row.result,
      at: row.at,
      href: subjectPath('REPAIR_RECORD', row.record.id),
      code: row.record.code,
      title: row.record.title,
      buildingId: row.record.buildingId,
    })),
  };
};

/** Demo task → the shared row; repair records add their status, priority and emergency flag. */
export const toMyTaskRow = (view: TaskView, record?: { status: RepairStatus; priority: Priority; locationId: string; emergency?: unknown }): MyTaskRow => ({
  id: view.task.id,
  label: TASK_KIND_LABEL[view.task.kind],
  href: subjectPath(view.task.subjectType, view.task.subjectId, view.tab),
  subjectType: view.task.subjectType,
  code: view.subjectCode,
  title: view.subjectTitle,
  buildingId: view.task.buildingId,
  ...(record ? { status: record.status, priority: record.priority, locationId: record.locationId } : {}),
  isEmergency: Boolean(record?.emergency),
  ...(view.task.dueAt ? { dueAt: view.task.dueAt } : {}),
  isOverdue: view.isOverdue,
  startedAt: view.task.createdAt,
});

/** Mock mode keeps the demo's stored tasks (repair and maintenance); done = closed in the last 30 days. */
const mockBoard = async (): Promise<MyTaskBoard> => {
  const views = await getMyTasks(true);
  const recordIds = views.filter((row) => row.task.subjectType === 'REPAIR_RECORD').map((row) => row.task.subjectId);
  const records = new Map((await getDb().records.bulkGet(recordIds)).flatMap((row) => (row ? [[row.id, row] as const] : [])));
  const since = Date.now() - DONE_DAYS_MS;
  return {
    today: todayVn(),
    open: views.filter((row) => row.task.status === 'OPEN').map((row) => toMyTaskRow(row, records.get(row.task.subjectId))),
    done: views
      .filter((row) => row.task.status === 'DONE' && row.task.completedAt && new Date(row.task.completedAt).getTime() >= since)
      .map((row) => ({
        id: row.task.id,
        label: TASK_KIND_LABEL[row.task.kind],
        result: 'Đã hoàn thành',
        at: row.task.completedAt as string,
        href: subjectPath(row.task.subjectType, row.task.subjectId, row.tab),
        code: row.subjectCode,
        title: row.subjectTitle,
        buildingId: row.task.buildingId,
      }))
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
};

export const getMyTaskBoard = (): Promise<MyTaskBoard> => (IS_API_MODE ? apiBoard() : mockBoard());
