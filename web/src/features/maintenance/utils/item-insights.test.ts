import type { MaintenanceItem, MaintenanceOccurrence, RepairRecord } from '@/domain/types';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { ageLabel, buildItemInsights, occurrenceDue, warrantyInfo } from './item-insights';

const TODAY = '2026-10-14';

const item = (overrides: Partial<MaintenanceItem> = {}): MaintenanceItem => ({
  id: 'it-1',
  code: 'TM-A01',
  buildingId: 'bld-a',
  locationId: 'loc-a',
  name: 'Thang máy số 1',
  type: 'Thang máy',
  ownerUserId: 'u-bql',
  documentIds: [],
  condition: 'GOOD',
  active: true,
  version: 1,
  createdAt: '2025-04-14T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const occurrence = (overrides: Partial<MaintenanceOccurrence>): MaintenanceOccurrence =>
  ({
    id: 'occ',
    code: 'BT-000',
    itemId: 'it-1',
    buildingId: 'bld-a',
    scheduledDate: TODAY,
    status: 'SCHEDULED',
    checklist: [],
    ...overrides,
  }) as MaintenanceOccurrence;

const row = (value: MaintenanceOccurrence, indicator: OccurrenceListItem['indicator'] = null): OccurrenceListItem => ({
  occurrence: value,
  indicator,
  needsReassignment: false,
});

const repair = (id: string, status: RepairRecord['status']): RepairRecord =>
  ({ id, code: id.toUpperCase(), title: `Sửa ${id}`, status, createdAt: '2026-09-01T01:30:00.000Z' }) as RepairRecord;

describe('item insights', () => {
  it('should classify warranty by days left and measure the used share', () => {
    expect(warrantyInfo({}, TODAY)).toEqual({ state: 'NONE' });
    expect(warrantyInfo({ installDate: '2025-10-14', warrantyUntil: '2027-10-14' }, TODAY)).toMatchObject({ state: 'ACTIVE', daysLeft: 365, usedPercent: 50 });
    expect(warrantyInfo({ warrantyUntil: '2026-11-01' }, TODAY)).toMatchObject({ state: 'EXPIRING', daysLeft: 18 });
    expect(warrantyInfo({ warrantyUntil: '2026-10-01' }, TODAY)).toMatchObject({ state: 'EXPIRED', daysLeft: -13 });
  });

  it('should describe the equipment age in years and months', () => {
    expect(ageLabel('2025-04-14', TODAY)).toBe('1 năm 6 tháng');
    expect(ageLabel('2026-10-01', TODAY)).toBe('Dưới 1 tháng');
    expect(ageLabel('2024-10-15', TODAY)).toBe('1 năm 11 tháng');
    expect(ageLabel('2027-01-01', TODAY)).toBeUndefined();
  });

  it('should pick the next open occurrence, flag overdue ones and sum approved repair costs', () => {
    const overdue = occurrence({ id: 'o1', code: 'BT-003', scheduledDate: '2026-10-11' });
    const later = occurrence({ id: 'o2', code: 'BT-004', scheduledDate: '2026-11-11' });
    const done = occurrence({
      id: 'o0',
      code: 'BT-002',
      scheduledDate: '2026-09-11',
      status: 'COMPLETED',
      completedAt: '2026-09-12T03:00:00.000Z',
      checklist: [{ templateItemId: 't1', label: 'Cáp tải', required: true, result: 'ISSUE', attachmentIds: [] }],
    });
    const insights = buildItemInsights(
      {
        item: item(),
        occurrences: [later, overdue, done],
        rows: [row(later), row(overdue, 'OVERDUE'), row(done)],
        repairs: [repair('sc-1', 'IN_CONSTRUCTION'), repair('sc-2', 'COMPLETED'), repair('sc-3', 'COMPLETED')],
        repairCosts: { 'sc-1': 18_000_000, 'sc-2': 3_500_000 },
      },
      TODAY,
    );

    expect(insights.nextOccurrence?.code).toBe('BT-003');
    expect(insights.nextIsOverdue).toBe(true);
    expect(insights.lastCompleted?.code).toBe('BT-002');
    expect(insights.upcoming.map((entry) => entry.occurrence.code)).toEqual(['BT-003', 'BT-004']);
    expect(insights.openRepairs.map((record) => record.id)).toEqual(['sc-1']);
    expect(insights.repairCostTotal).toBe(21_500_000);
    expect(insights.costedRepairCount).toBe(2);
    expect(insights.attention.map((entry) => entry.key)).toEqual(['overdue-o1', 'issue-o0', 'repair-sc-1']);
    expect(insights.attention[0].title).toBe('BT-003 quá hạn 3 ngày');
  });

  it('should report nothing to do for a healthy item', () => {
    const insights = buildItemInsights({ item: item(), occurrences: [], rows: [], repairs: [], repairCosts: {} }, TODAY);
    expect(insights.attention).toEqual([]);
    expect(insights.nextOccurrence).toBeUndefined();
    expect(insights.repairCostTotal).toBe(0);
  });

  it('should only call an occurrence overdue when its status can be overdue', () => {
    expect(occurrenceDue({ scheduledDate: '2026-10-12', status: 'SCHEDULED' }, TODAY)).toEqual({ text: 'Quá hạn 2 ngày', tone: 'crit' });
    expect(occurrenceDue({ scheduledDate: '2026-10-12', status: 'PENDING_REVIEW' }, TODAY)).toEqual({ text: 'Chờ kiểm tra', tone: 'muted' });
    expect(occurrenceDue({ scheduledDate: '2026-10-14', status: 'SCHEDULED' }, TODAY)).toEqual({ text: 'Hôm nay', tone: 'warn' });
    expect(occurrenceDue({ scheduledDate: '2026-10-30', status: 'SCHEDULED' }, TODAY)).toEqual({ text: 'Còn 16 ngày', tone: 'muted' });
  });
});
