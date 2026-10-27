import type { ScheduleUnit } from '@/domain/maintenance-periods';
import type { AuditEvent, IsoDate } from '@/domain/types';
import { apiRequest } from './http/client';
import { mapAuditEvent } from './http/mappers';
import type { ApiAuditEvent } from './http/mappers';

/** Plan states of SPEC MT-S2 (BR-MT2-04); "Đã kết thúc" is new compared with the demo. */
export type ApiPlanStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';

/** A checklist item as the API stores it (BR-MT2-03). */
export interface ApiChecklistItem {
  id: string;
  label: string;
  required: boolean;
  kind: 'CHECK' | 'MEASUREMENT';
  unit: string | null;
  min: number | null;
  max: number | null;
  photoRequired: boolean;
}

export interface ApiScheduleVersion {
  id: string;
  unit: ScheduleUnit;
  every: number;
  /** "Mỗi 2 tuần", "Mỗi tháng" … */
  label: string;
  effectiveFrom: IsoDate;
  anchorDate: IsoDate;
  reason: string | null;
  supersededBy: string | null;
  supersededAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ApiPlan {
  id: string;
  code: string;
  itemId: string;
  buildingId: string;
  name: string;
  status: ApiPlanStatus;
  managerUserId: string;
  performerUserId: string;
  reviewerUserId: string;
  contractorName: string | null;
  checklist: ApiChecklistItem[];
  activeSince: IsoDate | null;
  pausedOn: IsoDate | null;
  statusReason: string | null;
  schedule: ApiScheduleVersion | null;
  /** BR-MT2-02 "Cần giao lại" (list rows only). */
  needsReassignment: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlanItem {
  id: string;
  code: string;
  name: string;
  locationId: string;
  active: boolean;
}

export interface ApiPlanRow extends ApiPlan {
  item: ApiPlanItem;
  /** Nearest scheduled occurrence of an active plan. */
  nextDate: IsoDate | null;
}

export interface ApiOccurrence {
  id: string;
  code: string;
  planId: string;
  itemId: string;
  buildingId: string;
  scheduledDate: IsoDate;
  /** Null for a make-up occurrence. */
  periodDate: IsoDate | null;
  status: string;
  isMakeup: boolean;
  scheduleChanged: boolean;
  cancelReason: string | null;
  performerUserId: string;
  reviewerUserId: string;
  contractorName: string | null;
  version: number;
}

export interface ApiPlanDetail {
  plan: ApiPlan;
  item: ApiPlanItem;
  versions: ApiScheduleVersion[];
  occurrences: ApiOccurrence[];
  /** "Bỏ qua do tạm dừng" period dates. */
  skipped: IsoDate[];
  audit: AuditEvent[];
}

export interface ApiPlanFilters {
  buildingId?: string;
  itemId?: string;
  status?: ApiPlanStatus;
  includeEnded?: boolean;
}

/** `GET /maintenance-plans`: plans in scope; ended ones only when asked (ui-brief §2.1). */
export const listApiPlans = (filters: ApiPlanFilters = {}): Promise<ApiPlanRow[]> =>
  apiRequest<ApiPlanRow[]>('GET', '/maintenance-plans', {
    query: {
      buildingId: filters.buildingId || undefined,
      itemId: filters.itemId || undefined,
      status: filters.status || undefined,
      includeEnded: filters.includeEnded ? 1 : undefined,
    },
  });

/** `GET /maintenance-plans/:id`: plan, schedule history, occurrences, skipped periods and audit. */
export const getApiPlanDetail = async (planId: string): Promise<ApiPlanDetail> => {
  const body = await apiRequest<Omit<ApiPlanDetail, 'audit'> & { audit: ApiAuditEvent[] }>(
    'GET',
    `/maintenance-plans/${encodeURIComponent(planId)}`,
  );
  return { ...body, audit: body.audit.map(mapAuditEvent) };
};
