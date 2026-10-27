/** Payment instalments as served by api-qltn (SPEC B03–B09 v2 slice S4, D5-TDN). Money is integer VND as strings. */

export type PaymentKind = 'TAM_UNG' | 'QUYET_TOAN';
export type PaymentStatus = 'PENDING_APPROVAL' | 'NEEDS_UPDATE' | 'PENDING_TRANSFER' | 'TRANSFERRED';

export const PAYMENT_KIND_LABEL: Readonly<Record<PaymentKind, string>> = {
  TAM_UNG: 'Tạm ứng',
  QUYET_TOAN: 'Quyết toán',
};

export const PAYMENT_STATUS_LABEL: Readonly<Record<PaymentStatus, string>> = {
  PENDING_APPROVAL: 'Chờ duyệt',
  NEEDS_UPDATE: 'Cần bổ sung',
  PENDING_TRANSFER: 'Chờ chuyển khoản',
  TRANSFERRED: 'Đã chuyển khoản',
};

export interface PaymentDecision {
  id: string;
  revisionNo: number;
  stepKey: string;
  actorId: string;
  outcome: 'APPROVED' | 'NEEDS_UPDATE';
  reason: string | null;
  createdAt: string;
}

export interface PaymentInstalment {
  id: string;
  kind: PaymentKind;
  seqNo: number;
  status: PaymentStatus;
  revisionNo: number;
  settlementAmountVnd: string | null;
  amountVnd: string;
  payeeName: string;
  accountNo: string;
  bankName: string;
  transferContent: string;
  requestAttachmentIds: string[];
  invoiceAttachmentIds: string[];
  chainStepKeys: string[];
  currentStepKey: string | null;
  submittedBy: string;
  submittedAt: string;
  transferDate: string | null;
  transferReference: string | null;
  proofAttachmentIds: string[];
  confirmedBy: string | null;
  confirmedAt: string | null;
  decisions: PaymentDecision[];
  signatureDataUrl: string | null;
}

export interface PaymentDraftFields {
  amountVnd?: string;
  payeeName?: string;
  accountNo?: string;
  bankName?: string;
  transferContent?: string;
  requestAttachmentIds?: string[];
  invoiceAttachmentIds?: string[];
}

export interface PaymentHistory {
  approvedAmountVnd: string | null;
  transferredTotalVnd: string;
  draft: PaymentDraftFields | null;
  /** Oldest first. */
  payments: PaymentInstalment[];
}

/** FX-S2 BR-FX2-04: a 0-đồng settlement instalment needs no transfer (the advances already covered it). */
export const NO_TRANSFER_LABEL = 'Không cần chuyển khoản';

export const isNoTransferInstalment = (payment: Pick<PaymentInstalment, 'kind' | 'amountVnd'>): boolean =>
  payment.kind === 'QUYET_TOAN' && payment.amountVnd === '0';

/** Badge label; a 0-đồng settlement that is done reads "Không cần chuyển khoản" rather than "Đã chuyển khoản". */
export const instalmentStatusLabel = (payment: Pick<PaymentInstalment, 'kind' | 'amountVnd' | 'status'>): string =>
  payment.status === 'TRANSFERRED' && isNoTransferInstalment(payment) ? NO_TRANSFER_LABEL : PAYMENT_STATUS_LABEL[payment.status];

/** An advance not yet transferred blocks a new advance and the settlement (BR-S4-02, BR-S4-04). */
export const isOpenInstalment = (payment: PaymentInstalment): boolean => payment.status !== 'TRANSFERRED';

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ'];

/** Reads a 3-digit group; `full` keeps "không trăm" / "lẻ" when a higher group precedes it. */
const readGroup = (group: number, full: boolean): string => {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor((group % 100) / 10);
  const units = group % 10;
  const words: string[] = [];
  if (hundreds > 0 || full) words.push(`${DIGITS[hundreds]} trăm`);
  if (tens > 1) words.push(`${DIGITS[tens]} mươi`);
  else if (tens === 1) words.push('mười');
  else if (units > 0 && (hundreds > 0 || full)) words.push('lẻ');
  if (units === 1 && tens > 1) words.push('mốt');
  else if (units === 5 && tens > 0) words.push('lăm');
  else if (units === 4 && tens > 1) words.push('tư');
  else if (units > 0) words.push(DIGITS[units]);
  return words.join(' ');
};

/** "4000000" → "Bốn triệu đồng" (§4.4: the amount is also shown in words). Groups beyond "tỷ" repeat "tỷ". */
export const vndInWords = (value: string): string => {
  if (!/^\d+$/.test(value)) return '';
  let rest = BigInt(value);
  if (rest === 0n) return 'Không đồng';
  const groups: number[] = [];
  while (rest > 0n) {
    groups.push(Number(rest % 1000n));
    rest /= 1000n;
  }
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    if (groups[index] === 0) continue;
    const scale = index === 0 ? '' : SCALES[((index - 1) % 3) + 1] + ' tỷ'.repeat(Math.floor((index - 1) / 3));
    words.push([readGroup(groups[index], index < groups.length - 1), scale.trim()].filter(Boolean).join(' '));
  }
  const text = `${words.join(' ')} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
};
