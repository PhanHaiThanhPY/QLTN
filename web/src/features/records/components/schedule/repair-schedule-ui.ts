import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import type { ScheduleEntry } from '@/services/schedule-service';
import { addDays } from '@/utils/date';
import { monthLabel, monthRange, shiftMonth } from '@/features/maintenance/utils/maintenance-ui';

/** Full weekday names, Monday first, for column headers and the phone day list (ui-brief §2.3, §4). */
export const WEEKDAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'] as const;

export const EMPTY_SCHEDULE_HINT = 'Hồ sơ xuất hiện trên lịch khi bắt đầu thi công.';

/** "2026-11-24" → "24/11". */
export const shortDate = (date: IsoDate): string => `${date.slice(8)}/${date.slice(5, 7)}`;

/** The `count` days from `start`. */
export const daysFrom = (start: IsoDate, count: number): IsoDate[] => Array.from({ length: count }, (_, index) => addDays(start, index));

/** BR-B4-02: the entry occupies `day`. */
export const isOnDay = (entry: ScheduleEntry, day: IsoDate): boolean => entry.span.start <= day && entry.span.end >= day;

export const entriesOnDay = (entries: readonly ScheduleEntry[], day: IsoDate): ScheduleEntry[] => entries.filter((entry) => isOnDay(entry, day));

/** Construction finished (completion date recorded), whatever the record waits on next. */
const isBuilt = (entry: ScheduleEntry): boolean => Boolean(entry.construction?.completedDate) && entry.record.status !== 'NEEDS_REPAIR';

/** ui-brief §1 tokens: late, redo ("Cần khắc phục"), built, else running. */
export const entryTone = (entry: ScheduleEntry): string => {
  if (entry.isLate) return 'border-crit/30 bg-crit-soft text-ink';
  if (entry.record.status === 'NEEDS_REPAIR') return 'border-warn/30 bg-warn-soft text-ink';
  if (isBuilt(entry)) return 'border-good/30 bg-good-soft text-ink';
  return 'border-accent/30 bg-accent-soft/70 text-ink';
};

/** "20/11 – 26/11", plus " · xong 22/11" once built (BR-B4-07). */
export const spanText = (entry: ScheduleEntry): string => {
  const range = `${shortDate(entry.span.start)} – ${shortDate(entry.span.end)}`;
  const completed = entry.construction?.completedDate;
  return completed && isBuilt(entry) ? `${range} · xong ${shortDate(completed)}` : range;
};

/** "dự kiến 22/11" next to a late span (ui-brief §2.2). */
export const plannedNote = (entry: ScheduleEntry): string | null =>
  entry.isLate && entry.construction ? `dự kiến ${shortDate(entry.construction.plannedEndDate)}` : null;

export const recordTitle = (entry: ScheduleEntry): string => entry.record.title || '(Chưa đặt tên)';

/** Screen-reader name of an entry: "SC-031 Thay ống, 20/11 đến 26/11, Đang thi công, trễ thi công" (ui-brief §4). */
export const entryLabel = (entry: ScheduleEntry): string =>
  [
    `${entry.record.code} ${recordTitle(entry)}`,
    `${shortDate(entry.span.start)} đến ${shortDate(entry.span.end)}`,
    REPAIR_STATUS_LABEL[entry.record.status],
    entry.isLate ? 'trễ thi công' : null,
    entry.record.emergency ? 'khẩn cấp' : null,
  ]
    .filter(Boolean)
    .join(', ');

export { addDays, monthLabel, monthRange, shiftMonth };
export { mondayOf, WEEKDAY_LABELS, weekRangeLabel } from '@/utils/week';
