import type { StatusTone } from '@/components/ui/badge';
import { formatRate } from '@/domain/deposit';
import type { ComparisonRow, DepositSelectionStatus, InvitationStatus, PaymentKind, PaymentUnit } from '@/services/deposit-api';

/** SPEC T-S1 wording and ui-brief §1 tones. */
export const INVITATION_STATUS_TEXT: Readonly<Record<InvitationStatus, string>> = {
  DRAFT: 'Nháp',
  OPEN: 'Đang nhận bản chào',
  CLOSED: 'Đã hết hạn nhận',
  SELECTED: 'Đã chọn ngân hàng',
  NO_RESULT: 'Không có kết quả',
  CANCELLED: 'Đã hủy',
} as const;

export const INVITATION_STATUS_TONE: Readonly<Record<InvitationStatus, StatusTone>> = {
  DRAFT: 'neutral',
  OPEN: 'info',
  CLOSED: 'warn',
  SELECTED: 'good',
  NO_RESULT: 'neutral',
  CANCELLED: 'neutral',
} as const;

export const SELECTION_STATUS_TEXT: Readonly<Record<DepositSelectionStatus, string>> = {
  PENDING: 'Chờ duyệt',
  NEEDS_CHANGES: 'Cần sửa',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  SUPERSEDED: 'Đã thay thế',
} as const;

export const SELECTION_STATUS_TONE: Readonly<Record<DepositSelectionStatus, StatusTone>> = {
  PENDING: 'warn',
  NEEDS_CHANGES: 'warn',
  APPROVED: 'good',
  REJECTED: 'neutral',
  SUPERSEDED: 'neutral',
} as const;

export const DECISION_TEXT = {
  SUBMIT: 'Gửi duyệt',
  APPROVE: 'Duyệt',
  REQUEST_CHANGES: 'Yêu cầu sửa',
  REJECT: 'Từ chối',
} as const;

const UNIT_TEXT: Readonly<Record<PaymentUnit, string>> = { MONTH: 'tháng', DAY: 'ngày' } as const;

/** "6,0 %/năm" (ui-brief §0). */
export const rateText = (milli: number): string => `${formatRate(milli)} %/năm`;

/** "Trả lãi cuối kỳ" / "Trả lãi định kỳ mỗi 30 ngày". */
export const paymentText = (row: { paymentKind: PaymentKind; paymentEvery: number | null; paymentUnit: PaymentUnit | null }): string =>
  row.paymentKind === 'END' || !row.paymentUnit ? 'Trả lãi cuối kỳ' : `Trả lãi định kỳ mỗi ${row.paymentEvery ?? ''} ${UNIT_TEXT[row.paymentUnit]}`;

/**
 * The highest interest among complete offers on time, or among all complete ones when none is on time — the API's rule
 * (BR-T1-09), read again from a frozen comparison (ranked rows).
 */
export const highestOf = (rows: readonly ComparisonRow[]): ComparisonRow | null => {
  const complete = rows.filter((row) => row.completeness === 'COMPLETE');
  return complete.find((row) => !row.isLate) ?? complete[0] ?? null;
};

/** "còn 2 ngày" / "còn 5 giờ" / "đã qua hạn". */
export const remainingText = (deadlineAt: string | null, now: Date): string | null => {
  if (!deadlineAt) return null;
  const left = new Date(deadlineAt).getTime() - now.getTime();
  if (left <= 0) return 'đã qua hạn';
  const hours = Math.floor(left / 3_600_000);
  return hours >= 24 ? `còn ${Math.floor(hours / 24)} ngày` : `còn ${Math.max(hours, 1)} giờ`;
};
