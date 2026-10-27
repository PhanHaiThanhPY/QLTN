import { PRIORITY_LABEL } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import type { MyTaskRow } from '@/services/my-tasks-service';
import { toVnDate } from '@/utils/date';

/** "Hạn" filter of the list (BR-TK-08). */
export type DueFilter = 'ALL' | 'OVERDUE' | 'TODAY' | 'WITH_DUE' | 'NO_DUE';
export const DUE_FILTER_LABEL: Record<DueFilter, string> = {
  ALL: 'Tất cả hạn',
  OVERDUE: 'Quá hạn',
  TODAY: 'Đến hạn hôm nay',
  WITH_DUE: 'Có hạn',
  NO_DUE: 'Không có hạn',
};

export interface TaskFilters {
  search: string;
  buildingId: string;
  label: string;
  due: DueFilter;
  /** Mock only: repair or maintenance. */
  subject: 'ALL' | 'REPAIR' | 'MAINTENANCE';
}

export const NO_FILTERS: TaskFilters = { search: '', buildingId: '', label: '', due: 'ALL', subject: 'ALL' };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const URGENT: readonly string[] = ['URGENT', 'HIGH'];

/** Folds Vietnamese marks and case so "bom" finds "Sửa máy bơm" and "sc-031" finds "SC-031" (TD-03). */
export const fold = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();

const dueDay = (row: MyTaskRow): IsoDate | undefined => (row.dueAt ? toVnDate(row.dueAt) : undefined);

/** Due today in Vietnam time and not yet overdue (BR-TK-07, TD-02). */
export const isDueToday = (row: MyTaskRow, today: IsoDate): boolean => !row.isOverdue && dueDay(row) === today;

const DUE_MATCH: Record<DueFilter, (row: MyTaskRow, today: IsoDate) => boolean> = {
  ALL: () => true,
  OVERDUE: (row) => row.isOverdue,
  TODAY: isDueToday,
  WITH_DUE: (row) => Boolean(row.dueAt),
  NO_DUE: (row) => !row.dueAt,
};

export const matchesFilters = (row: MyTaskRow, filters: TaskFilters, today: IsoDate): boolean => {
  const query = fold(filters.search);
  if (query && !fold(`${row.code} ${row.title} ${row.label}`).includes(query)) return false;
  if (filters.buildingId && row.buildingId !== filters.buildingId) return false;
  if (filters.label && row.label !== filters.label) return false;
  if (filters.subject === 'REPAIR' && row.subjectType !== 'REPAIR_RECORD') return false;
  if (filters.subject === 'MAINTENANCE' && row.subjectType === 'REPAIR_RECORD') return false;
  return DUE_MATCH[filters.due](row, today);
};

export const hasFilters = (filters: TaskFilters): boolean =>
  Boolean(filters.search.trim() || filters.buildingId || filters.label || filters.due !== 'ALL' || filters.subject !== 'ALL');

export interface TaskCounts {
  open: number;
  overdue: number;
  dueToday: number;
  done: number;
}

export const countTasks = (open: readonly MyTaskRow[], doneCount: number, today: IsoDate): TaskCounts => ({
  open: open.length,
  overdue: open.filter((row) => row.isOverdue).length,
  dueToday: open.filter((row) => isDueToday(row, today)).length,
  done: doneCount,
});

/** BR-TK-07 groups: overdue, then emergency or urgent/high records, then tasks with a deadline, then the rest. */
const groupOf = (row: MyTaskRow): number => {
  if (row.isOverdue) return 0;
  if (row.isEmergency || (row.priority && URGENT.includes(row.priority))) return 1;
  return row.dueAt ? 2 : 3;
};

export const compareTasks = (a: MyTaskRow, b: MyTaskRow): number =>
  groupOf(a) - groupOf(b) ||
  (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') ||
  (a.startedAt ?? '9999').localeCompare(b.startedAt ?? '9999') ||
  a.code.localeCompare(b.code);

/** "Quá hạn 2 ngày", or in hours below one day (ui-brief §1). */
export const overdueText = (dueAt: string, now: Date): string => {
  const late = now.getTime() - new Date(dueAt).getTime();
  return late >= DAY_MS ? `Quá hạn ${Math.floor(late / DAY_MS)} ngày` : `Quá hạn ${Math.max(1, Math.floor(late / HOUR_MS))} giờ`;
};

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const part = (dueAt: string, type: Intl.DateTimeFormatPartTypes): string =>
  parts.formatToParts(new Date(dueAt)).find((row) => row.type === type)?.value ?? '';

/** "12/11 · 09:00" in Vietnam time (BR-TK-05). */
export const dueText = (dueAt: string): string => `${part(dueAt, 'day')}/${part(dueAt, 'month')} · ${part(dueAt, 'hour')}:${part(dueAt, 'minute')}`;

/** "Hôm nay 16:00". */
export const todayText = (dueAt: string): string => `Hôm nay ${part(dueAt, 'hour')}:${part(dueAt, 'minute')}`;

/** "dd/mm/yyyy" of a Vietnam date. */
export const vnDayLabel = (date: IsoDate): string => date.split('-').reverse().join('/');

/** Readable name of a row: "Xác nhận hồ sơ SC-031, quá hạn 2 ngày, ưu tiên cao" (ui-brief §4). */
export const taskAriaLabel = (row: MyTaskRow, now: Date, today: IsoDate): string =>
  [
    `${row.label} ${row.code}`,
    row.isOverdue && row.dueAt ? overdueText(row.dueAt, now).toLowerCase() : null,
    !row.isOverdue && row.dueAt && isDueToday(row, today) ? `hạn ${todayText(row.dueAt).toLowerCase()}` : null,
    !row.dueAt ? 'không có hạn' : null,
    row.priority === 'URGENT' || row.priority === 'HIGH' ? `ưu tiên ${PRIORITY_LABEL[row.priority].toLowerCase()}` : null,
    row.isEmergency ? 'xử lý khẩn cấp' : null,
  ]
    .filter(Boolean)
    .join(', ');
