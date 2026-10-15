import { ALERT_RULES } from './constants';
import type { IsoDate, MaintenanceItem, RepairRecord } from './types';
import { addDays, formatDate, toVnDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';

export type RepairAlertKind = 'WARRANTY' | 'RECENT_REPAIR' | 'REPEATED' | 'PRICE' | 'EMERGENCY_OVER_LIMIT';

export interface RepairAlert {
  kind: RepairAlertKind;
  title: string;
  message: string;
  /** Other records the alert refers to (shown as links). */
  related: Pick<RepairRecord, 'id' | 'code'>[];
}

/** Another repair on the same item, with the amount approved for it when known. */
export interface ItemRepairHistory {
  record: RepairRecord;
  approvedAmount?: number;
}

export interface RepairAlertInput {
  record: RepairRecord;
  item?: MaintenanceItem;
  /** Other records of the same item (the record itself excluded). */
  history: ItemRepairHistory[];
  /** Amount being proposed or approved for this record, when there is one. */
  amount?: number;
  /** Thresholds of the building configuration; defaults to ALERT_RULES. */
  rules?: AlertThresholds;
}

export interface AlertThresholds {
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}

const DEFAULT_RULES: AlertThresholds = {
  recentRepairDays: ALERT_RULES.RECENT_REPAIR_DAYS,
  repeatMinRecords: ALERT_RULES.REPEAT_MIN_RECORDS,
  priceRatio: ALERT_RULES.PRICE_RATIO,
};

const rulesOf = (input: RepairAlertInput): AlertThresholds => input.rules ?? DEFAULT_RULES;

const IGNORED: readonly RepairRecord['status'][] = ['CLOSED_NO_REPAIR', 'CLOSED_WITHDRAWN'];

const warrantyAlert = ({ record, item }: RepairAlertInput): RepairAlert | null => {
  if (!item?.warrantyUntil) return null;
  const reported = toVnDate(record.createdAt);
  if (item.warrantyUntil < reported) return null;
  const supplier = item.supplier ? ` (${item.supplier})` : '';
  return {
    kind: 'WARRANTY',
    title: 'Thiết bị còn bảo hành',
    message: `${item.code} còn bảo hành đến ${formatDate(item.warrantyUntil)}. Ưu tiên yêu cầu bảo hành nhà cung cấp${supplier}; chi phí phát sinh cần người có quyền xác nhận.`,
    related: [],
  };
};

const recentRepairAlert = (input: RepairAlertInput): RepairAlert | null => {
  const { record, history } = input;
  const days = rulesOf(input).recentRepairDays;
  const reported = toVnDate(record.createdAt);
  const from: IsoDate = addDays(reported, -days);
  const recent = history
    .map((row) => row.record)
    .filter((row) => row.status === 'COMPLETED' && row.closedAt && toVnDate(row.closedAt) >= from && row.closedAt < record.createdAt)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const last = recent[0];
  if (!last?.closedAt) return null;
  return {
    kind: 'RECENT_REPAIR',
    title: 'Mới sửa đã hỏng lại',
    message: `Lần sửa gần nhất ${last.code} hoàn tất ngày ${formatDate(toVnDate(last.closedAt))}, chưa quá ${days} ngày. Cần kiểm tra nguyên nhân và trách nhiệm bảo hành của lần sửa trước.`,
    related: [{ id: last.id, code: last.code }],
  };
};

const repeatedAlert = (input: RepairAlertInput): RepairAlert | null => {
  const { record, history } = input;
  const from = addDays(toVnDate(record.createdAt), -ALERT_RULES.REPEAT_WINDOW_DAYS);
  const earlier = history
    .map((row) => row.record)
    .filter((row) => !IGNORED.includes(row.status) && row.createdAt < record.createdAt && toVnDate(row.createdAt) >= from);
  if (earlier.length < rulesOf(input).repeatMinRecords) return null;
  return {
    kind: 'REPEATED',
    title: 'Hỏng lặp lại',
    message: `Hạng mục đã có ${earlier.length} hồ sơ sửa chữa trong 12 tháng trước hồ sơ này. Nên xem lại phương án đã dùng hoặc cân nhắc thay mới.`,
    related: earlier.map((row) => ({ id: row.id, code: row.code })),
  };
};

const priceAlert = (input: RepairAlertInput): RepairAlert | null => {
  const { amount, history } = input;
  const ratioLimit = rulesOf(input).priceRatio;
  const previous = history.filter((row) => row.approvedAmount !== undefined);
  if (amount === undefined || previous.length === 0) return null;
  const average = previous.reduce((sum, row) => sum + (row.approvedAmount ?? 0), 0) / previous.length;
  if (amount <= average * ratioLimit) return null;
  const ratio = (amount / average).toFixed(1).replace('.', ',');
  return {
    kind: 'PRICE',
    title: 'Giá cao bất thường',
    message: `Giá trình ${formatVnd(amount)} gấp ${ratio} lần trung bình ${previous.length} lần sửa trước của hạng mục (${formatVnd(Math.round(average))}). Cần giải trình khi trình duyệt.`,
    related: previous.map((row) => ({ id: row.record.id, code: row.record.code })),
  };
};

/** Proposed amount above the emergency limit that applied when work started. */
const emergencyAlert = ({ record, amount }: RepairAlertInput): RepairAlert | null => {
  const emergency = record.emergency;
  if (!emergency || amount === undefined || amount <= emergency.limitVnd) return null;
  return {
    kind: 'EMERGENCY_OVER_LIMIT',
    title: 'Vượt hạn mức sửa chữa khẩn cấp',
    message: `Giá trình ${formatVnd(amount)} vượt hạn mức khẩn cấp ${formatVnd(emergency.limitVnd)} của tòa. Phần vượt cần người có quyền xác nhận khi duyệt.`,
    related: [],
  };
};

/**
 * Rule-based warnings from proposal section 2.3 (warranty, recent repair, repeated failure, unusual price).
 * They inform the people involved; they never block a step.
 */
export const computeRepairAlerts = (input: RepairAlertInput): RepairAlert[] =>
  [warrantyAlert(input), recentRepairAlert(input), repeatedAlert(input), priceAlert(input), emergencyAlert(input)].filter(
    (alert): alert is RepairAlert => alert !== null,
  );

/** Whether an item is still under warranty on a given day. */
export const isUnderWarranty = (item: Pick<MaintenanceItem, 'warrantyUntil'>, today: IsoDate): boolean =>
  Boolean(item.warrantyUntil && item.warrantyUntil >= today);
