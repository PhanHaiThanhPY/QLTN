import { LIMITS } from '@/domain/constants';
import type { RepairStatusGroup } from '@/domain/constants';
import type { IsoDate, IsoDateTime, RepairRecord } from '@/domain/types';
import { IS_API_MODE } from '@/config/data-source';
import { apiList } from './http/client';
import { mapRepairRecord } from './http/mappers';
import type { ApiRepairRecord } from './http/mappers';
import { listRecords, listRepairSchedule } from './records-service';
import type { Page } from './records-service';

/** Largest page the API serves for the schedule; the week and month grids ask for it (B4-S1 BR-B4-06). */
export const SCHEDULE_GRID_LIMIT = 200;
/** Rows of the "Chờ xếp lịch" block before "Xem tất cả" (ui-brief §2.5). */
export const AWAITING_LIMIT = 10;

export interface ScheduleFilters {
  buildingId?: string;
  locationId?: string;
  statusGroup?: RepairStatusGroup | '';
}

export interface ScheduleQuery extends ScheduleFilters {
  from?: IsoDate;
  to?: IsoDate;
  page?: number;
  pageSize?: number;
}

/** One construction on the calendar; `span` and `isLate` come from the API (B4-S1 BR-B4-01, BR-B4-04). */
export interface ScheduleEntry {
  record: RepairRecord;
  construction?: { startDate: IsoDate; plannedEndDate: IsoDate; completedDate?: IsoDate; progressPercent: number };
  span: { start: IsoDate; end: IsoDate };
  isLate: boolean;
  /** Contractor of the approved quotation (api mode). */
  contractorName?: string;
}

export interface AwaitingEntry {
  record: RepairRecord;
  contractorName?: string;
  /** When the record became "Chờ thi công"; unknown in mock mode. */
  readySince?: IsoDateTime;
}

interface ApiScheduleEntry {
  record: ApiRepairRecord;
  construction: { startDate: IsoDate; plannedEndDate: IsoDate; completedDate: IsoDate | null; progressPercent: number };
  span: { start: IsoDate; end: IsoDate };
  isLate: boolean;
}

interface ApiAwaitingEntry {
  record: ApiRepairRecord;
  readySince: IsoDateTime | null;
}

const toPage = <T>(items: T[], meta: { page: number; limit: number; total: number } | undefined, page: number, pageSize: number): Page<T> => ({
  items,
  total: meta?.total ?? items.length,
  page: meta?.page ?? page,
  pageSize: meta?.limit ?? pageSize,
});

/**
 * Mock mode keeps the demo calendar (SPEC B4-S1 §2, AC-B4.12): its filter still reads the start date, and a record
 * without construction shows on its task due date. Only the shape is shared with api mode.
 */
const listMockSchedule = async (query: ScheduleQuery): Promise<Page<ScheduleEntry>> => {
  const page = await listRepairSchedule({ ...query, dateFrom: query.from, dateTo: query.to });
  const items = page.items.flatMap((row): ScheduleEntry[] => {
    if (!row.scheduledDate) return [];
    const { construction } = row;
    return [
      {
        record: row.record,
        construction: construction && {
          startDate: construction.startDate,
          plannedEndDate: construction.plannedEndDate,
          completedDate: construction.completedDate,
          progressPercent: construction.progressPercent,
        },
        span: { start: row.scheduledDate, end: construction?.plannedEndDate ?? row.scheduledDate },
        isLate: row.isOverdue,
      },
    ];
  });
  return { ...page, items };
};

/** Constructions whose span shares a day with `from`–`to` (`GET /records/schedule`), start date then code. */
export const listSchedule = async (query: ScheduleQuery = {}): Promise<Page<ScheduleEntry>> => {
  if (!IS_API_MODE) return listMockSchedule(query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? LIMITS.PAGE_SIZE;
  const result = await apiList<ApiScheduleEntry>('GET', '/records/schedule', {
    query: {
      page,
      limit: pageSize,
      buildingId: query.buildingId || undefined,
      locationId: query.locationId || undefined,
      statusGroup: query.statusGroup || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
    },
  });
  const items = result.data.map(
    (row): ScheduleEntry => ({
      record: mapRepairRecord(row.record),
      construction: { ...row.construction, completedDate: row.construction.completedDate ?? undefined },
      span: row.span,
      isLate: row.isLate,
      contractorName: row.record.executingContractorName ?? undefined,
    }),
  );
  return toPage(items, result.meta, page, pageSize);
};

/** "Chờ xếp lịch": approved records not started yet, oldest approval first (`GET /records/schedule/awaiting`). */
export const listAwaitingSchedule = async (filters: Pick<ScheduleFilters, 'buildingId' | 'locationId'> = {}): Promise<Page<AwaitingEntry>> => {
  if (!IS_API_MODE) {
    const page = await listRecords({ ...filters, status: 'READY_FOR_CONSTRUCTION', page: 1, pageSize: AWAITING_LIMIT });
    return { ...page, items: page.items.map(({ record }) => ({ record })) };
  }
  const result = await apiList<ApiAwaitingEntry>('GET', '/records/schedule/awaiting', {
    query: { page: 1, limit: AWAITING_LIMIT, buildingId: filters.buildingId || undefined, locationId: filters.locationId || undefined },
  });
  const items = result.data.map(
    (row): AwaitingEntry => ({
      record: mapRepairRecord(row.record),
      readySince: row.readySince ?? undefined,
      contractorName: row.record.executingContractorName ?? undefined,
    }),
  );
  return toPage(items, result.meta, 1, AWAITING_LIMIT);
};
