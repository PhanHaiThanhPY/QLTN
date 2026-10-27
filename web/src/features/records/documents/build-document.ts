import type { RecordDetail } from '@/services/records-service';
import type { DocumentKind } from './document-list';
import { buildMinutesModel, type MinutesPrintModel } from './minutes-model';
import { buildPaymentLetterModel, type PaymentLetterModel } from './payment-letter-model';
import type { PrintNames, PrintSignature } from './print-format';
import { buildProposalModel, type ProposalPrintModel } from './proposal-model';

export type PrintableDocument =
  | { kind: 'proposal'; model: ProposalPrintModel }
  | { kind: 'minutes'; model: MinutesPrintModel }
  | { kind: 'payment'; model: PaymentLetterModel };

/** The document `docId` of `kind`, or null when the record has no such printable document (shown as 404). */
export const buildDocument = (detail: RecordDetail, kind: DocumentKind, docId: string, names: PrintNames): PrintableDocument | null => {
  if (kind === 'proposal') {
    const submission = detail.quoteProposal?.submissions.find((row) => row.id === docId);
    return submission ? { kind, model: buildProposalModel(detail, submission, names) } : null;
  }
  if (kind === 'minutes') {
    const round = detail.execution?.acceptances.find((row) => row.id === docId);
    return round ? { kind, model: buildMinutesModel(detail, round, names) } : null;
  }
  const payment = detail.paymentHistory?.payments.find((row) => row.id === docId);
  // BR-B7-01: a 0-đồng settlement has no letter.
  if (!payment || (payment.kind === 'QUYET_TOAN' && payment.amountVnd === '0')) return null;
  return { kind, model: buildPaymentLetterModel(detail, payment, names) };
};

/** BR-B7-04: what is printed across an unfinished document, and what a screen reader says for it (F-B7-S1-01). */
export const WATERMARKS = {
  unapproved: { text: 'CHƯA PHÊ DUYỆT', spoken: 'Bản chưa phê duyệt' },
  incomplete: { text: 'CHƯA HOÀN TẤT', spoken: 'Bản chưa hoàn tất' },
} as const;
export type Watermark = (typeof WATERMARKS)[keyof typeof WATERMARKS];

/** BR-B7-04: the watermark of a document that is not final yet. */
export const watermarkOf = (document: PrintableDocument): Watermark | undefined => {
  if (document.kind === 'minutes') return document.model.isComplete ? undefined : WATERMARKS.incomplete;
  return document.model.isApproved ? undefined : WATERMARKS.unapproved;
};

/** Every signature the document prints; the print waits until each image is loaded (F-B7-S1-02). */
const slotsOf = (document: PrintableDocument): Array<PrintSignature | null> => {
  if (document.kind === 'proposal') return [document.model.boardSignature, document.model.managerSignature];
  if (document.kind === 'minutes') return document.model.columns.map((column) => column.signature);
  return [document.model.managerSignature];
};

export const signaturesOf = (document: PrintableDocument): PrintSignature[] =>
  slotsOf(document).filter((signature): signature is PrintSignature => signature !== null);

/** Identity of one signature slot on the sheet. */
export const signatureKey = (signature: PrintSignature): string => `${signature.signerName}|${signature.signedAt}`;
