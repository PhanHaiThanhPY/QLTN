/**
 * Construction schedule rules (SPEC B4-S1 BR-B4-01, BR-B4-02, BR-B4-04). Dates are `YYYY-MM-DD` in Vietnam time, so
 * plain string comparison orders them.
 */
import { RECORD_FINAL_STATUSES } from './record-status-groups';

/** Statuses after which a record is over: its construction no longer runs. */
const FINISHED_STATUSES: readonly string[] = RECORD_FINAL_STATUSES;

/** Acceptance failed, the contractor is redoing the work; there is no deadline for the redo (D-B4-2). */
const NEEDS_REPAIR = 'NEEDS_REPAIR';

export interface ScheduleConstruction {
  startDate: string;
  plannedEndDate: string;
  completedDate: string | null;
}

export interface ScheduleSpan {
  start: string;
  end: string;
}

const later = (a: string, b: string): string => (a > b ? a : b);

/** BR-B4-04: not completed, still running outside "Cần khắc phục", and past the planned end. */
export const isConstructionLate = (construction: ScheduleConstruction, status: string, today: string): boolean =>
  construction.completedDate === null &&
  !FINISHED_STATUSES.includes(status) &&
  status !== NEEDS_REPAIR &&
  construction.plannedEndDate < today;

const lastDayOf = (construction: ScheduleConstruction, status: string, today: string): string => {
  if (status === NEEDS_REPAIR) return later(today, construction.plannedEndDate);
  if (construction.completedDate) return construction.completedDate;
  if (FINISHED_STATUSES.includes(status)) return construction.plannedEndDate;
  // Still running: a late construction stays on the calendar up to today (D-B4-1).
  return later(construction.plannedEndDate, today);
};

/** BR-B4-01: the days a started construction occupies on the calendar. */
export const scheduleSpan = (construction: ScheduleConstruction, status: string, today: string): ScheduleSpan => ({
  start: construction.startDate,
  end: later(lastDayOf(construction, status, today), construction.startDate),
});

/** BR-B4-02: a span matches a range when they share at least one day; an open bound does not filter. */
export const spanOverlaps = (span: ScheduleSpan, from?: string, to?: string): boolean =>
  (!to || span.start <= to) && (!from || span.end >= from);

/**
 * SQL bound that never excludes a matching row: every span ends on or before the latest of the completed date, the
 * planned end and today (`GREATEST` skips NULL). The exact rule runs on the loaded rows with `scheduleSpan`.
 */
export const SPAN_END_UPPER_BOUND_SQL = 'GREATEST(c.completed_date, c.planned_end_date, CAST(:today AS date))';
