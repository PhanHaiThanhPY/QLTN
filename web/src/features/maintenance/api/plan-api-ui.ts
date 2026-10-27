import type { StatusTone } from '@/components/ui/badge';
import { OCCURRENCE_STATUS } from '@/domain/constants';
import type { OccurrenceStatus } from '@/domain/constants';
import { addDays, nextPeriodAfter, periodDate } from '@/domain/maintenance-periods';
import type { ScheduleUnit } from '@/domain/maintenance-periods';
import type { IsoDate, User } from '@/domain/types';
import type { ApiOccurrence, ApiPlanDetail, ApiPlanItem, ApiPlanRow, ApiPlanStatus } from '@/services/maintenance-plans-api';

export const PLAN_STATUS_TEXT: Readonly<Record<ApiPlanStatus, string>> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang chạy',
  PAUSED: 'Tạm dừng',
  ENDED: 'Đã kết thúc',
} as const;

/** ui-brief §1: Nháp neutral, Đang chạy good, Tạm dừng warn, Đã kết thúc neutral. */
export const PLAN_STATUS_TONE: Readonly<Record<ApiPlanStatus, StatusTone>> = {
  DRAFT: 'neutral',
  ACTIVE: 'good',
  PAUSED: 'warn',
  ENDED: 'neutral',
} as const;

export const PLAN_STATUS_FILTERS: ReadonlyArray<readonly [ApiPlanStatus, string]> = [
  ['ACTIVE', PLAN_STATUS_TEXT.ACTIVE],
  ['PAUSED', PLAN_STATUS_TEXT.PAUSED],
  ['DRAFT', PLAN_STATUS_TEXT.DRAFT],
  ['ENDED', PLAN_STATUS_TEXT.ENDED],
] as const;

export const isOccurrenceStatus = (value: string): value is OccurrenceStatus => Object.values(OCCURRENCE_STATUS).some((status) => status === value);

export const SCHEDULE_LIMIT: Readonly<Record<ScheduleUnit, number>> = { WEEK: 8, MONTH: 24 } as const;
export const PREVIEW_COUNT = 3;
const DUE_SOON_DAYS = 7;

/** dd/mm of an ISO day. */
export const ddmm = (date: IsoDate): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** The first periods of a schedule from its start (form aside, ui-brief §2.2). */
export const previewDates = (unit: ScheduleUnit, every: number, start: IsoDate, count = PREVIEW_COUNT): IsoDate[] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(every) || every < 1 || every > SCHEDULE_LIMIT[unit]) return [];
  return Array.from({ length: count }, (_, n) => periodDate({ unit, every, anchorDate: start }, n));
};

export interface PlanKpis {
  active: number;
  dueSoon: number;
  paused: number;
  draft: number;
}

/** ui-brief §2.1 cards: running, next occurrence within 7 days, paused, drafts. */
export const planKpis = (rows: readonly ApiPlanRow[], today: IsoDate): PlanKpis => {
  const soon = addDays(today, DUE_SOON_DAYS);
  return {
    active: rows.filter((row) => row.status === 'ACTIVE').length,
    dueSoon: rows.filter((row) => row.nextDate && row.nextDate <= soon).length,
    paused: rows.filter((row) => row.status === 'PAUSED').length,
    draft: rows.filter((row) => row.status === 'DRAFT').length,
  };
};

const holdsPlace = (user: User, item: Pick<ApiPlanItem, 'locationId'>, buildingId: string): boolean =>
  user.active && user.buildingIds.includes(buildingId) && (!user.locationIds?.length || user.locationIds.includes(item.locationId));

/** BR-MT2-02 performer: an active KT or BQL of the item's building and location. */
export const eligiblePerformers = (users: readonly User[], item: Pick<ApiPlanItem, 'locationId'>, buildingId: string): User[] =>
  users.filter((user) => (user.role === 'TECH_CONFIRMER' || user.role === 'BQL') && holdsPlace(user, item, buildingId));

/** BR-MT2-02 reviewer: an active KT of the item's place, other than the performer. */
export const eligibleReviewers = (
  users: readonly User[],
  item: Pick<ApiPlanItem, 'locationId'>,
  buildingId: string,
  performerUserId: string,
): User[] => users.filter((user) => user.role === 'TECH_CONFIRMER' && user.id !== performerUserId && holdsPlace(user, item, buildingId));

export type PlanTimelineRow = { kind: 'occurrence'; date: IsoDate; occurrence: ApiOccurrence } | { kind: 'skipped'; date: IsoDate };

/** Occurrences and "Bỏ qua do tạm dừng" periods in one list, newest first (ui-brief §2.3). */
export const planTimeline = (detail: Pick<ApiPlanDetail, 'occurrences' | 'skipped'>): PlanTimelineRow[] =>
  [
    ...detail.occurrences.map((occurrence): PlanTimelineRow => ({ kind: 'occurrence', date: occurrence.scheduledDate, occurrence })),
    ...detail.skipped.map((date): PlanTimelineRow => ({ kind: 'skipped', date })),
  ].sort((a, b) => b.date.localeCompare(a.date));

/** Last day a scheduled occurrence may move to: the day before the next period (BR-MT2-07), if any. */
export const latestRescheduleDay = (detail: Pick<ApiPlanDetail, 'versions'>, occurrence: ApiOccurrence): IsoDate | undefined => {
  const next = nextPeriodAfter(detail.versions, occurrence.periodDate ?? occurrence.scheduledDate);
  return next ? addDays(next, -1) : undefined;
};

/** Scheduled occurrences that a pause or an end would cancel. */
export const scheduledCount = (occurrences: readonly ApiOccurrence[]): number =>
  occurrences.filter((row) => row.status === 'SCHEDULED').length;

/** Scheduled non-make-up occurrences of periods from `from`: the ones a schedule change would flag. */
export const flaggedByChange = (occurrences: readonly ApiOccurrence[], from: IsoDate): number =>
  occurrences.filter((row) => row.status === 'SCHEDULED' && !row.isMakeup && row.periodDate !== null && row.periodDate >= from).length;
