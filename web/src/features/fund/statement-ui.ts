import type { StatusTone } from '@/components/ui/badge';
import type { RecordKind, RowResult, StatementLine } from '@/services/statement-api';
import { spokenVnd } from './fund-ui';

/** ui-brief §1: statement line states, always with words. */
export const LINE_STATUS_TEXT: Readonly<Record<StatementLine['status'], string>> = {
  UNMATCHED: 'Chưa ghép',
  MATCHED: 'Đã ghép',
  RECORDED: 'Đã ghi nhận từ sao kê',
} as const;

export const LINE_STATUS_TONE: Readonly<Record<StatementLine['status'], StatusTone>> = {
  UNMATCHED: 'warn',
  MATCHED: 'good',
  RECORDED: 'info',
} as const;

export const RESULT_TEXT: Readonly<Record<RowResult, string>> = {
  NEW: 'Mới',
  DUPLICATE: 'Trùng (bỏ qua)',
  POSSIBLE_DUPLICATE: 'Có thể trùng',
} as const;

export const RECORD_KIND_TEXT: Readonly<Record<RecordKind, string>> = {
  BANK_FEE: 'Phí ngân hàng',
  INTEREST: 'Lãi không kỳ hạn',
} as const;

/** "ngày 18 tháng 11" for a screen reader. */
const spokenDate = (iso: string): string => `ngày ${Number(iso.slice(8, 10))} tháng ${Number(iso.slice(5, 7))}`;

/** ui-brief §4: "GD-001, ngày 18 tháng 11, cộng mười triệu đồng, đã ghép với PT-001". */
export const pairName = (line: Pick<StatementLine, 'code' | 'txnDate' | 'amountVnd' | 'direction'>, sourceCode?: string): string =>
  [line.code, spokenDate(line.txnDate), spokenVnd(line.amountVnd, line.direction), sourceCode ? `đã ghép với ${sourceCode}` : 'chưa ghép'].join(', ');

/** "lệch 1 ngày" / "cùng ngày" next to a candidate (ui-brief §2.1). */
export const daysText = (days: number): string => (days === 0 ? 'cùng số tiền, cùng ngày' : `cùng số tiền, lệch ${days} ngày`);
