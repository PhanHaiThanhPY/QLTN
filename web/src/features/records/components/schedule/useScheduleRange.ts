import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listSchedule, SCHEDULE_GRID_LIMIT } from '@/services/schedule-service';
import type { ScheduleFilters } from '@/services/schedule-service';
import type { IsoDate } from '@/domain/types';

/** Entries of one week or month grid: one page of the largest size; beyond it the grid says "n trên m" (BR-B4-06). */
export const useScheduleRange = (filters: ScheduleFilters, from: IsoDate, to: IsoDate) =>
  useServiceQuery(['repair-schedule', 'range', filters, from, to], () =>
    listSchedule({ ...filters, from, to, page: 1, pageSize: SCHEDULE_GRID_LIMIT }),
  );
