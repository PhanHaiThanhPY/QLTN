import type { RepairScheduleListItem } from '@/services/records-service';
import { addDays, formatDate, formatDateTime } from '@/utils/date';
import { monthLabel, monthRange, shiftMonth } from '@/features/maintenance/utils/maintenance-ui';

export const scheduleLabel = (row: RepairScheduleListItem): string => {
  if (row.construction) return `${formatDate(row.construction.startDate)} – ${formatDate(row.construction.plannedEndDate)}`;
  if (row.record.dueAt) return `Hạn ${formatDateTime(row.record.dueAt)}`;
  return 'Chưa xếp lịch';
};

export const groupByDate = (rows: RepairScheduleListItem[]): Map<string, RepairScheduleListItem[]> => {
  const map = new Map<string, RepairScheduleListItem[]>();
  rows.forEach((row) => {
    if (!row.scheduledDate) return;
    map.set(row.scheduledDate, [...(map.get(row.scheduledDate) ?? []), row]);
  });
  return map;
};

export { addDays, monthLabel, monthRange, shiftMonth };
export { mondayOf, WEEKDAY_LABELS, weekRangeLabel } from '@/utils/week';
