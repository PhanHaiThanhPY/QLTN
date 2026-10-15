import type { MaintenanceItem } from '@/domain/types';
import type { ItemListRow } from '@/services/maintenance-service';
import { countQuickFilters, visibleItemRows } from './item-list';

const TODAY = '2026-10-14';

const row = (code: string, overrides: Partial<ItemListRow> = {}, item: Partial<MaintenanceItem> = {}): ItemListRow => ({
  item: { id: code, code, name: `Thiết bị ${code}`, condition: 'GOOD', active: true, ...item } as MaintenanceItem,
  overdueCount: 0,
  openRepairCount: 0,
  repairCount: 0,
  ...overrides,
});

const rows: ItemListRow[] = [
  row('A', { nextOccurrence: { id: 'o1', code: 'BT-1', scheduledDate: '2026-11-01', status: 'SCHEDULED' } }),
  row('B', { overdueCount: 1, nextOccurrence: { id: 'o2', code: 'BT-2', scheduledDate: '2026-10-01', status: 'SCHEDULED' } }),
  row('C', { openRepairCount: 1, repairCount: 2 }),
  row('D', {}, { warrantyUntil: '2026-10-30' }),
  row('E', {}, { condition: 'NEEDS_ATTENTION' }),
];

describe('equipment list filters', () => {
  it('should count every quick view, attention being the union of problems', () => {
    expect(countQuickFilters(rows, TODAY)).toEqual({ all: 5, attention: 4, overdue: 1, repairing: 1, warranty: 1 });
  });

  it('should filter by quick view', () => {
    expect(visibleItemRows(rows, 'repairing', 'code', TODAY).map((entry) => entry.item.code)).toEqual(['C']);
    expect(visibleItemRows(rows, 'attention', 'code', TODAY).map((entry) => entry.item.code)).toEqual(['B', 'C', 'D', 'E']);
  });

  it('should sort by next maintenance with overdue first and unscheduled items last', () => {
    expect(visibleItemRows(rows, 'all', 'next', TODAY).map((entry) => entry.item.code)).toEqual(['B', 'A', 'C', 'D', 'E']);
  });
});
