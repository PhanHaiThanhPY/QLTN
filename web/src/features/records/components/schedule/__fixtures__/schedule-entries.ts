import type { RepairRecord } from '@/domain/types';
import type { ScheduleEntry } from '@/services/schedule-service';

/** A calendar entry of building A; `record` fields beyond the ones the schedule reads are left out. */
export const entry = (
  code: string,
  start: string,
  end: string,
  overrides: { status?: string; isLate?: boolean; completedDate?: string; plannedEndDate?: string; emergency?: boolean } = {},
): ScheduleEntry => ({
  record: {
    id: `rec-${code}`,
    code,
    title: `Công việc ${code}`,
    buildingId: 'bld-a',
    locationId: 'loc-1',
    status: overrides.status ?? 'IN_CONSTRUCTION',
    managerUserId: 'usr-bql',
    ...(overrides.emergency ? { emergency: { reason: 'Vỡ ống' } } : {}),
  } as unknown as RepairRecord,
  construction: {
    startDate: start,
    plannedEndDate: overrides.plannedEndDate ?? end,
    completedDate: overrides.completedDate,
    progressPercent: 40,
  },
  span: { start, end },
  isLate: overrides.isLate ?? false,
});
