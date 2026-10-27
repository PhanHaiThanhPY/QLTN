import type { StatusTone } from '@/components/ui/badge';
import { vndInWords } from '@/domain/payment';
import type { Fund, LedgerCategory, LedgerDirection, VoucherCategory, VoucherStatus } from '@/services/fund-api';
import { formatVndText } from '@/utils/money';

/** BR-F3-03 wording: "Thu theo hợp đồng khai thác", never "thanh toán" (FG-05). */
export const CATEGORY_TEXT: Readonly<Record<LedgerCategory, string>> = {
  CONTRACT_RECEIPT: 'Thu theo hợp đồng khai thác',
  DEPOSIT: 'Nhận tiền cọc',
  TAX: 'Chi thuế',
  SERVICE: 'Chi dịch vụ',
  TRANSFER: 'Chuyển quỹ',
  OTHER: 'Chi khác',
  BANK_FEE: 'Phí ngân hàng',
  INTEREST: 'Lãi không kỳ hạn',
} as const;

/** Short names for the ledger's "Nhóm" column (ui-brief §2.1). */
export const CATEGORY_SHORT: Readonly<Record<LedgerCategory, string>> = {
  CONTRACT_RECEIPT: 'Thu HĐ',
  DEPOSIT: 'Nhận cọc',
  TAX: 'Chi thuế',
  SERVICE: 'Chi DV',
  TRANSFER: 'Chuyển quỹ',
  OTHER: 'Chi khác',
  BANK_FEE: 'Phí NH',
  INTEREST: 'Lãi',
} as const;

export const DIRECTION_TEXT: Readonly<Record<LedgerDirection, string>> = { IN: 'Thu', OUT: 'Chi' } as const;

export const VOUCHER_CATEGORY_TEXT: Readonly<Record<VoucherCategory, string>> = {
  SERVICE: 'Chi dịch vụ',
  TRANSFER: 'Chuyển sang quỹ khác',
  OTHER: 'Chi khác',
} as const;

/** D-F3-4: until group T exists, the maintenance fund is the only receiving fund. */
export const TARGET_FUND_TEXT = { BAO_TRI: 'Quỹ bảo trì' } as const;

export const VOUCHER_STATUS_TEXT: Readonly<Record<VoucherStatus, string>> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  NEEDS_CHANGES: 'Cần sửa',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  PAID: 'Đã chi',
  CANCELLED: 'Đã hủy',
} as const;

export const VOUCHER_STATUS_TONE: Readonly<Record<VoucherStatus, StatusTone>> = {
  DRAFT: 'neutral',
  PENDING: 'info',
  NEEDS_CHANGES: 'warn',
  APPROVED: 'good',
  REJECTED: 'crit',
  PAID: 'good',
  CANCELLED: 'neutral',
} as const;

export const DECISION_TEXT: Readonly<Record<string, string>> = {
  SUBMIT: 'Gửi duyệt',
  APPROVE: 'Duyệt',
  REQUEST_CHANGES: 'Yêu cầu sửa',
  REJECT: 'Từ chối',
  PAY: 'Ghi đã chi',
  CANCEL: 'Hủy',
  REQUEST_CANCEL: 'Đề nghị hủy phiếu đã chi',
  APPROVE_CANCEL: 'Duyệt hủy',
  REJECT_CANCEL: 'Từ chối hủy',
} as const;

/** "+10.000.000 ₫" / "−3.000.000 ₫": the sign is never left to colour alone (ui-brief §0). */
export const signedVnd = (direction: LedgerDirection, amountVnd: string): string =>
  `${direction === 'IN' ? '+' : '−'}${formatVndText(amountVnd)}`;

/** What a screen reader says for an amount: "cộng mười triệu đồng" (ui-brief §4). */
export const spokenVnd = (amountVnd: string, direction?: LedgerDirection): string => {
  const words = vndInWords(amountVnd.replace(/^-/, '')).toLowerCase();
  if (!direction) return words;
  return `${direction === 'IN' ? 'cộng' : 'trừ'} ${words}`;
};

/** BR-F3-02: the full number when the API gives it (Kế toán, BQT), else the last four digits. */
export const accountText = (fund: Pick<Fund, 'accountNo' | 'accountMasked'>): string => fund.accountNo ?? fund.accountMasked ?? '—';

/** "2026-11" → "Tháng 11/2026". */
export const monthText = (month: string): string => `Tháng ${month.slice(5)}/${month.slice(0, 4)}`;
