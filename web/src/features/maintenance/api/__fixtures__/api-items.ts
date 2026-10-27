import type { MaintenanceItem, User } from '@/domain/types';
import { BUILDING_A, SEED_USERS, USER_ID } from '@/mock/seed-reference';
import type { ApiItemDetail, ApiItemRow } from '@/services/maintenance-items-api';

export const userOf = (id: string): User => SEED_USERS.find((user) => user.id === id) as User;
export const BQL_A = userOf(USER_ID.BQL_A);
/** TVKT: reads equipment, holds neither MAINTENANCE_MANAGE nor ITEM_CONDITION. */
export const READ_ONLY = userOf(USER_ID.TVKT);

export const itemOf = (code: string, overrides: Partial<MaintenanceItem> = {}): MaintenanceItem => ({
  id: `itm-${code}`,
  code,
  buildingId: BUILDING_A,
  locationId: 'loc-a-b2',
  name: `Thiết bị ${code}`,
  type: 'Bơm nước',
  ownerUserId: USER_ID.BQL_A,
  documentIds: [],
  condition: 'UNKNOWN',
  active: true,
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

export const rowOf = (code: string, overrides: Partial<ApiItemRow> = {}, item: Partial<MaintenanceItem> = {}): ApiItemRow => ({
  item: itemOf(code, item),
  repairCount: 0,
  openRepairCount: 0,
  approvedTotalVnd: '0',
  warranty: 'ACTIVE',
  needsAttention: false,
  ...overrides,
});

export const detailOf = (overrides: Partial<ApiItemDetail> = {}, item: Partial<MaintenanceItem> = {}): ApiItemDetail => ({
  item: itemOf('BOM-A09', { warrantyUntil: '2026-11-16', ...item }),
  repairCount: 2,
  openRepairCount: 1,
  approvedTotalVnd: '16500000',
  warranty: 'EXPIRING',
  repairs: [
    { id: 'rec-h2', code: 'SC-102', title: 'Thay phớt bơm', status: 'IN_CONSTRUCTION', createdAt: '2026-10-20T03:00:00.000Z', approvedAmountVnd: '4000000' },
    { id: 'rec-h1', code: 'SC-101', title: 'Thay vòng bi', status: 'COMPLETED', createdAt: '2026-09-02T03:00:00.000Z', approvedAmountVnd: '12500000' },
  ],
  documents: [],
  audit: [],
  ...overrides,
});
