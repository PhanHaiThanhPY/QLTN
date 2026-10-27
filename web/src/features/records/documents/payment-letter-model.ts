import { vndInWords, type PaymentInstalment } from '@/domain/payment';
import type { RecordDetail } from '@/services/records-service';
import { orDots, printVnd, type PrintNames, type PrintSignature } from './print-format';

/** Opening sentence of the letter, with the organisation name replaced by "Ban Quản lý" (§3.3). */
export const LETTER_OPENING = 'Ban Quản lý trân trọng đề nghị Quý Ban quản trị chuyển khoản thanh toán theo bộ hồ sơ đính kèm như sau:';

export interface LetterAttachment {
  label: string;
  isPresent: boolean;
}

export interface PaymentLetterModel {
  title: string;
  isApproved: boolean;
  recipient: string;
  payeeName: string;
  accountNo: string;
  bankName: string;
  amount: string;
  amountInWords: string;
  /** Settlement after transferred advances: "(Số quyết toán X − tạm ứng đã chuyển Y)". */
  computation: string | null;
  transferContent: string;
  attachments: LetterAttachment[];
  managerSignature: PrintSignature | null;
}

/** An instalment counts as approved once the PAYMENT chain is done (waiting for, or after, the transfer). */
const APPROVED_STATUSES: readonly string[] = ['PENDING_TRANSFER', 'TRANSFERRED'];

const hasFile = (detail: RecordDetail, ids: readonly string[], purpose: string): boolean =>
  detail.attachments.some((file) => ids.includes(file.id) && file.purpose === purpose);

/** §3.3 "Bộ hồ sơ đính kèm": the settlement lists the form's 4 lines, an advance its 2. */
export const letterAttachments = (detail: RecordDetail, payment: PaymentInstalment): LetterAttachment[] => {
  const request = { label: payment.kind === 'TAM_UNG' ? 'Đề nghị tạm ứng của nhà thầu' : 'Công văn đề nghị thanh toán của nhà thầu', isPresent: payment.requestAttachmentIds.length > 0 && hasFile(detail, payment.requestAttachmentIds, 'PAYMENT_REQUEST') };
  const proposal = { label: 'Tờ trình và báo giá đã được phê duyệt', isPresent: Boolean(detail.record.approvedSubmissionId) };
  if (payment.kind === 'TAM_UNG') return [request, proposal];
  return [
    request,
    proposal,
    { label: 'Biên bản nghiệm thu hoàn thành', isPresent: (detail.execution?.acceptances ?? []).some((round) => round.outcome === 'PASSED') },
    { label: 'Hóa đơn GTGT', isPresent: payment.invoiceAttachmentIds.length > 0 && hasFile(detail, payment.invoiceAttachmentIds, 'INVOICE') },
  ];
};

/** §3.3: the fields of the payment letter (`BAN QUẢN LÝ VINHOMES GOLDEN RIVER.docx`) for one instalment. */
export const buildPaymentLetterModel = (detail: RecordDetail, payment: PaymentInstalment, names: PrintNames): PaymentLetterModel => {
  const settled = payment.settlementAmountVnd;
  const deducted = settled !== null ? (BigInt(settled) - BigInt(payment.amountVnd)).toString() : '0';
  return {
    title: `Thư đề nghị thanh toán đợt ${payment.seqNo} ${payment.kind === 'TAM_UNG' ? 'tạm ứng' : 'quyết toán'}`,
    isApproved: APPROVED_STATUSES.includes(payment.status),
    recipient: `Ban quản trị tòa nhà ${names.building(detail.record.buildingId)}`,
    payeeName: orDots(payment.payeeName),
    accountNo: orDots(payment.accountNo),
    bankName: orDots(payment.bankName),
    amount: printVnd(payment.amountVnd),
    amountInWords: vndInWords(payment.amountVnd),
    computation: settled !== null && deducted !== '0' ? `(Số quyết toán ${printVnd(settled)} − tạm ứng đã chuyển ${printVnd(deducted)})` : null,
    transferContent: orDots(payment.transferContent),
    attachments: letterAttachments(detail, payment),
    managerSignature: payment.signatureDataUrl
      ? { imageDataUrl: payment.signatureDataUrl, signerName: names.person(payment.submittedBy), signedAt: payment.submittedAt }
      : null,
  };
};
