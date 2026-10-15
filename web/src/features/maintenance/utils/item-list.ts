import type { IsoDate } from '@/domain/types';
import type { ItemListRow } from '@/services/maintenance-service';
import { warrantyInfo } from './item-insights';

export const ITEM_QUICK_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần xử lý' },
  { value: 'overdue', label: 'Quá hạn bảo trì' },
  { value: 'repairing', label: 'Đang sửa chữa' },
  { value: 'warranty', label: 'Sắp hết bảo hành' },
] as const;
export type ItemQuickFilter = (typeof ITEM_QUICK_FILTERS)[number]['value'];

export const ITEM_SORTS = [
  { value: 'next', label: 'Bảo trì kế tiếp gần nhất' },
  { value: 'code', label: 'Mã thiết bị' },
  { value: 'name', label: 'Tên thiết bị' },
] as const;
export type ItemSort = (typeof ITEM_SORTS)[number]['value'];

export const isItemQuickFilter = (value: string | null): value is ItemQuickFilter => ITEM_QUICK_FILTERS.some((entry) => entry.value === value);
export const isItemSort = (value: string | null): value is ItemSort => ITEM_SORTS.some((entry) => entry.value === value);

const isWarrantyExpiring = (row: ItemListRow, today: IsoDate): boolean => warrantyInfo(row.item, today).state === 'EXPIRING';

const MATCHERS: Record<ItemQuickFilter, (row: ItemListRow, today: IsoDate) => boolean> = {
  all: () => true,
  overdue: (row) => row.overdueCount > 0,
  repairing: (row) => row.openRepairCount > 0,
  warranty: isWarrantyExpiring,
  attention: (row, today) =>
    row.overdueCount > 0 || row.openRepairCount > 0 || row.item.condition === 'NEEDS_ATTENTION' || isWarrantyExpiring(row, today),
};

export const matchesQuickFilter = (row: ItemListRow, filter: ItemQuickFilter, today: IsoDate): boolean => MATCHERS[filter](row, today);

/** Count of rows per quick filter (shown on the filter chips). */
export const countQuickFilters = (rows: ItemListRow[], today: IsoDate): Record<ItemQuickFilter, number> => {
  const counts = { all: 0, attention: 0, overdue: 0, repairing: 0, warranty: 0 };
  for (const row of rows) {
    for (const entry of ITEM_QUICK_FILTERS) if (matchesQuickFilter(row, entry.value, today)) counts[entry.value] += 1;
  }
  return counts;
};

/** "Next" puts overdue items first, then the nearest date; items without an open occurrence go last. */
const COMPARATORS: Record<ItemSort, (a: ItemListRow, b: ItemListRow) => number> = {
  code: (a, b) => a.item.code.localeCompare(b.item.code),
  name: (a, b) => a.item.name.localeCompare(b.item.name, 'vi'),
  next: (a, b) => {
    const left = a.nextOccurrence?.scheduledDate;
    const right = b.nextOccurrence?.scheduledDate;
    if (left && right) return left.localeCompare(right) || a.item.code.localeCompare(b.item.code);
    if (left) return -1;
    if (right) return 1;
    return a.item.code.localeCompare(b.item.code);
  },
};

export const visibleItemRows = (rows: ItemListRow[], filter: ItemQuickFilter, sort: ItemSort, today: IsoDate): ItemListRow[] =>
  rows.filter((row) => matchesQuickFilter(row, filter, today)).sort(COMPARATORS[sort]);
