import { REPAIR_STATUS_LABEL, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import type { ApiItemDetail, ApiItemRow, ApiWarrantyState } from '@/services/maintenance-items-api';
import { diffDays, formatDate } from '@/utils/date';
import type { AttentionItem } from '../utils/item-insights';
import type { ItemQuickFilter, ItemSort } from '../utils/item-list';

/** MT-S1 BR-MT-07: the quick views without "Quá hạn bảo trì" (no plans in api mode yet). */
export const API_QUICK_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần xử lý' },
  { value: 'repairing', label: 'Đang sửa chữa' },
  { value: 'warranty', label: 'Sắp hết bảo hành' },
] as const satisfies ReadonlyArray<{ value: ItemQuickFilter; label: string }>;

export const API_SORTS = [
  { value: 'code', label: 'Mã thiết bị' },
  { value: 'name', label: 'Tên thiết bị' },
] as const satisfies ReadonlyArray<{ value: ItemSort; label: string }>;

export const ITEM_PAGE_SIZE = 20;

/** The flags come from the API (BR-MT-07, BR-MT-11); the screen only picks rows by them. */
const MATCHERS: Record<ItemQuickFilter, (row: ApiItemRow) => boolean> = {
  all: () => true,
  attention: (row) => row.needsAttention,
  repairing: (row) => row.openRepairCount > 0,
  warranty: (row) => row.warranty === 'EXPIRING',
  overdue: () => false,
};

export const countApiQuickFilters = (rows: readonly ApiItemRow[]): Record<ItemQuickFilter, number> => ({
  all: rows.length,
  attention: rows.filter(MATCHERS.attention).length,
  repairing: rows.filter(MATCHERS.repairing).length,
  warranty: rows.filter(MATCHERS.warranty).length,
  overdue: 0,
});

const COMPARATORS: Record<ItemSort, (a: ApiItemRow, b: ApiItemRow) => number> = {
  code: (a, b) => a.item.code.localeCompare(b.item.code),
  name: (a, b) => a.item.name.localeCompare(b.item.name, 'vi') || a.item.code.localeCompare(b.item.code),
  next: (a, b) => a.item.code.localeCompare(b.item.code),
};

export const visibleApiRows = (rows: readonly ApiItemRow[], filter: ItemQuickFilter, sort: ItemSort): ApiItemRow[] =>
  rows.filter(MATCHERS[filter]).sort(COMPARATORS[sort]);

/** "Bảo hành" card of the item page: days left, ended, or none. */
export const warrantyKpi = (state: ApiWarrantyState, until: IsoDate | undefined, today: IsoDate): { value: string; hint: string } => {
  if (state === 'NONE' || !until) return { value: 'Không có', hint: 'Chưa nhập ngày bảo hành' };
  if (state === 'EXPIRED') return { value: 'Đã hết', hint: `Hết từ ${formatDate(until)}` };
  return { value: `Còn ${diffDays(today, until)} ngày`, hint: `Đến ${formatDate(until)}` };
};

const warrantyAttention = (detail: ApiItemDetail): AttentionItem[] => {
  const until = detail.item.warrantyUntil ? formatDate(detail.item.warrantyUntil) : '';
  if (detail.warranty === 'EXPIRING') return [{ key: 'warranty', tone: 'warn', title: 'Bảo hành sắp hết', detail: until, to: '?tab=overview' }];
  if (detail.warranty === 'EXPIRED') return [{ key: 'warranty', tone: 'info', title: 'Đã hết bảo hành', detail: until, to: '?tab=overview' }];
  return [];
};

/** "Cần chú ý" of the item page (BR-MT-08): open repairs, condition "Cần chú ý", warranty ending or ended. */
export const apiAttentionItems = (detail: ApiItemDetail): AttentionItem[] => {
  const open = detail.repairs
    .filter((repair) => !REPAIR_FINAL_STATUSES.includes(repair.status))
    .map((repair): AttentionItem => ({
      key: repair.id,
      tone: 'info',
      title: `${repair.code} đang mở`,
      detail: REPAIR_STATUS_LABEL[repair.status],
      to: `/records/${repair.id}`,
    }));
  const condition: AttentionItem[] =
    detail.item.condition === 'NEEDS_ATTENTION'
      ? [{ key: 'condition', tone: 'warn', title: 'Tình trạng cần chú ý', detail: detail.item.conditionNote ?? 'Xem lịch sử thay đổi', to: '?tab=history' }]
      : [];
  const warranty = warrantyAttention(detail);
  return [...open, ...condition, ...warranty];
};
