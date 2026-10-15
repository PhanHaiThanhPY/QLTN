import { OCCURRENCE_FINAL_STATUSES, OCCURRENCE_OVERDUE_STATUSES, OCCURRENCE_STATUS_LABEL, REPAIR_FINAL_STATUSES, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { IsoDate, MaintenanceItem, MaintenanceOccurrence, RepairRecord } from '@/domain/types';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { diffDays, formatDate, toVnDate } from '@/utils/date';

/** Warranty is shown as "expiring" inside this many days. */
export const WARRANTY_EXPIRING_DAYS = 30;

export type WarrantyState = 'NONE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface WarrantyInfo {
  state: WarrantyState;
  until?: IsoDate;
  /** Days until the end date (negative once expired). */
  daysLeft?: number;
  /** Share of the warranty period already used, 0–100, when the install date is known. */
  usedPercent?: number;
}

export type AttentionTone = 'crit' | 'warn' | 'info';

export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  to: string;
}

export interface ItemInsights {
  /** Earliest open occurrence (overdue ones first by date). */
  nextOccurrence?: MaintenanceOccurrence;
  nextIsOverdue: boolean;
  /** Most recently completed occurrence. */
  lastCompleted?: MaintenanceOccurrence;
  upcoming: OccurrenceListItem[];
  overdue: OccurrenceListItem[];
  openRepairs: RepairRecord[];
  /** Sum of approved amounts (whole VND) over linked repairs. */
  repairCostTotal: number;
  costedRepairCount: number;
  warranty: WarrantyInfo;
  /** "1 năm 6 tháng" since installation; undefined without an install date. */
  ageLabel?: string;
  attention: AttentionItem[];
}

export interface ItemInsightsInput {
  item: MaintenanceItem;
  occurrences: MaintenanceOccurrence[];
  rows: OccurrenceListItem[];
  repairs: RepairRecord[];
  repairCosts: Record<string, number>;
}

const UPCOMING_LIMIT = 3;

const isOpenOccurrence = (occurrence: MaintenanceOccurrence): boolean => !OCCURRENCE_FINAL_STATUSES.includes(occurrence.status);

export const warrantyInfo = (item: Pick<MaintenanceItem, 'installDate' | 'warrantyUntil'>, today: IsoDate): WarrantyInfo => {
  if (!item.warrantyUntil) return { state: 'NONE' };
  const daysLeft = diffDays(today, item.warrantyUntil);
  let usedPercent: number | undefined;
  if (item.installDate && item.installDate < item.warrantyUntil) {
    const total = diffDays(item.installDate, item.warrantyUntil);
    usedPercent = Math.min(100, Math.max(0, Math.round((diffDays(item.installDate, today) / total) * 100)));
  }
  let state: WarrantyState = 'ACTIVE';
  if (daysLeft < 0) state = 'EXPIRED';
  else if (daysLeft <= WARRANTY_EXPIRING_DAYS) state = 'EXPIRING';
  return { state, until: item.warrantyUntil, daysLeft, usedPercent };
};

/** Whole years and months between two dates, e.g. "1 năm 6 tháng". */
export const ageLabel = (from: IsoDate, today: IsoDate): string | undefined => {
  if (from > today) return undefined;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  if (months < 1) return 'Dưới 1 tháng';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 ? `${years} năm` : '', rest > 0 ? `${rest} tháng` : ''].filter(Boolean);
  return parts.join(' ');
};

const occurrencePath = (occurrence: MaintenanceOccurrence): string => `/maintenance/occurrences/${occurrence.id}`;

const attentionItems = (input: ItemInsightsInput, insights: Omit<ItemInsights, 'attention'>, today: IsoDate): AttentionItem[] => {
  const items: AttentionItem[] = insights.overdue.map(({ occurrence }) => ({
    key: `overdue-${occurrence.id}`,
    tone: 'crit',
    title: `${occurrence.code} quá hạn ${diffDays(occurrence.scheduledDate, today)} ngày`,
    detail: `Dự kiến ${formatDate(occurrence.scheduledDate)} nhưng chưa hoàn thành.`,
    to: occurrencePath(occurrence),
  }));
  const lastIssue = insights.lastCompleted?.checklist.filter((entry) => entry.result === 'ISSUE') ?? [];
  if (insights.lastCompleted && lastIssue.length > 0) {
    items.push({
      key: `issue-${insights.lastCompleted.id}`,
      tone: 'warn',
      title: `Lượt ${insights.lastCompleted.code} ghi nhận ${lastIssue.length} vấn đề`,
      detail: lastIssue.map((entry) => entry.label).join(', '),
      to: occurrencePath(insights.lastCompleted),
    });
  }
  if (input.item.condition === 'NEEDS_ATTENTION') {
    items.push({
      key: 'condition',
      tone: 'warn',
      title: 'Tình trạng thiết bị: Cần chú ý',
      detail: input.item.conditionNote ?? 'Chưa có ghi chú tình trạng.',
      to: '?tab=history',
    });
  }
  for (const record of insights.openRepairs) {
    items.push({
      key: `repair-${record.id}`,
      tone: 'info',
      title: `Hồ sơ sửa chữa đang mở: ${record.code}`,
      detail: `${record.title} · ${REPAIR_STATUS_LABEL[record.status]}`,
      to: `/records/${record.id}`,
    });
  }
  if (insights.warranty.state === 'EXPIRING' && insights.warranty.until) {
    items.push({
      key: 'warranty',
      tone: 'warn',
      title: `Bảo hành còn ${insights.warranty.daysLeft ?? 0} ngày`,
      detail: `Hết hạn ${formatDate(insights.warranty.until)}. Kiểm tra lỗi cần bảo hành trước thời điểm này.`,
      to: '?tab=documents',
    });
  }
  return items;
};

/** Derived health of one item: what is due, what needs attention and what it has cost. */
export const buildItemInsights = (input: ItemInsightsInput, today: IsoDate): ItemInsights => {
  const openRows = input.rows
    .filter(({ occurrence }) => isOpenOccurrence(occurrence))
    .sort((a, b) => a.occurrence.scheduledDate.localeCompare(b.occurrence.scheduledDate));
  const overdue = openRows.filter((row) => row.indicator === 'OVERDUE');
  const completed = input.occurrences
    .filter((row) => row.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? b.scheduledDate).localeCompare(a.completedAt ?? a.scheduledDate));
  const costed = input.repairs.filter((record) => input.repairCosts[record.id] !== undefined);
  const base = {
    nextOccurrence: openRows[0]?.occurrence,
    nextIsOverdue: openRows[0]?.indicator === 'OVERDUE',
    lastCompleted: completed[0],
    upcoming: openRows.slice(0, UPCOMING_LIMIT),
    overdue,
    openRepairs: input.repairs.filter((record) => !REPAIR_FINAL_STATUSES.includes(record.status)),
    repairCostTotal: costed.reduce((sum, record) => sum + (input.repairCosts[record.id] ?? 0), 0),
    costedRepairCount: costed.length,
    warranty: warrantyInfo(input.item, today),
    ageLabel: input.item.installDate ? ageLabel(input.item.installDate, today) : undefined,
  };
  return { ...base, attention: attentionItems(input, base, today) };
};

/** Date of the last completion, as a VN calendar date. */
export const completedDateOf = (occurrence: MaintenanceOccurrence): IsoDate =>
  occurrence.completedAt ? toVnDate(occurrence.completedAt) : occurrence.scheduledDate;

export type DueTone = 'crit' | 'warn' | 'muted';

/**
 * How far an open occurrence is from its date. Only statuses that can be overdue (spec 6.2) say "Quá hạn";
 * a visit waiting for review shows its status instead, so the text always matches the overdue counters.
 */
export const occurrenceDue = (
  occurrence: Pick<MaintenanceOccurrence, 'scheduledDate' | 'status'>,
  today: IsoDate,
): { text: string; tone: DueTone } => {
  const days = diffDays(today, occurrence.scheduledDate);
  if (days < 0 && !OCCURRENCE_OVERDUE_STATUSES.includes(occurrence.status)) return { text: OCCURRENCE_STATUS_LABEL[occurrence.status], tone: 'muted' };
  if (days < 0) return { text: `Quá hạn ${-days} ngày`, tone: 'crit' };
  if (days === 0) return { text: 'Hôm nay', tone: 'warn' };
  return { text: `Còn ${days} ngày`, tone: days <= 7 ? 'warn' : 'muted' };
};
