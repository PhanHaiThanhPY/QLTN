import type { RecordDetail } from '@/services/records-service';
import type { DocumentKind } from './document-list';
import { buildMinutesModel, type MinutesPrintModel } from './minutes-model';
import { buildPaymentLetterModel, type PaymentLetterModel } from './payment-letter-model';
import type { PrintNames } from './print-format';
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

/** BR-B7-04: the watermark of a document that is not final yet. */
export const watermarkOf = (document: PrintableDocument): string | undefined => {
  if (document.kind === 'minutes') return document.model.isComplete ? undefined : 'CHƯA HOÀN TẤT';
  return document.model.isApproved ? undefined : 'CHƯA PHÊ DUYỆT';
};
