import { BUILDING_A, USER_ID } from '@/mock/seed-reference';
import type { ApiOccurrence, ApiPlan, ApiPlanDetail, ApiPlanRow, ApiScheduleVersion } from '@/services/maintenance-plans-api';

export const versionOf = (overrides: Partial<ApiScheduleVersion> = {}): ApiScheduleVersion => ({
  id: 'ver-1',
  unit: 'MONTH',
  every: 1,
  label: 'Mỗi tháng',
  effectiveFrom: '2026-11-12',
  anchorDate: '2026-11-12',
  reason: null,
  supersededBy: null,
  supersededAt: null,
  createdBy: USER_ID.BQL_A,
  createdAt: '2026-10-27T01:00:00.000Z',
  ...overrides,
});

export const planOf = (overrides: Partial<ApiPlan> = {}): ApiPlan => ({
  id: 'pl-1',
  code: 'KH-007',
  itemId: 'itm-BOM-A09',
  buildingId: BUILDING_A,
  name: 'Kiểm tra bơm hằng tháng',
  status: 'ACTIVE',
  managerUserId: USER_ID.BQL_A,
  performerUserId: USER_ID.KT_A,
  reviewerUserId: USER_ID.KT_A2,
  contractorName: null,
  checklist: [{ id: 'c1', label: 'Vận hành', required: true, kind: 'CHECK', unit: null, min: null, max: null, photoRequired: false }],
  activeSince: '2026-10-27',
  pausedOn: null,
  statusReason: null,
  schedule: versionOf(),
  needsReassignment: false,
  version: 2,
  createdAt: '2026-10-27T01:00:00.000Z',
  updatedAt: '2026-10-27T01:00:00.000Z',
  ...overrides,
});

export const occurrenceOf = (code: string, overrides: Partial<ApiOccurrence> = {}): ApiOccurrence => ({
  id: `oc-${code}`,
  code,
  planId: 'pl-1',
  itemId: 'itm-BOM-A09',
  buildingId: BUILDING_A,
  scheduledDate: '2026-11-12',
  periodDate: '2026-11-12',
  status: 'SCHEDULED',
  isMakeup: false,
  scheduleChanged: false,
  cancelReason: null,
  performerUserId: USER_ID.KT_A,
  reviewerUserId: USER_ID.KT_A2,
  contractorName: null,
  version: 1,
  ...overrides,
});

export const planDetailOf = (overrides: Partial<ApiPlanDetail> = {}, plan: Partial<ApiPlan> = {}): ApiPlanDetail => ({
  plan: planOf(plan),
  item: { id: 'itm-BOM-A09', code: 'BOM-A09', name: 'Bơm nước', locationId: 'loc-a-b2', active: true },
  versions: [versionOf()],
  occurrences: [occurrenceOf('BT-0042')],
  skipped: [],
  audit: [],
  ...overrides,
});

export const planRowOf = (overrides: Partial<ApiPlanRow> = {}): ApiPlanRow => ({
  ...planOf(),
  item: { id: 'itm-BOM-A09', code: 'BOM-A09', name: 'Bơm nước', locationId: 'loc-a-b2', active: true },
  nextDate: '2026-11-12',
  ...overrides,
});
