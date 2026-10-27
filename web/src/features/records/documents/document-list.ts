import type { BadgeTone } from '@/components/ui/badge';
import type { RecordDetail } from '@/services/records-service';

/** The three D5 documents of a record (SPEC B7-S1 §2). */
export type DocumentKind = 'proposal' | 'minutes' | 'payment';
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['proposal', 'minutes', 'payment'];
export const isDocumentKind = (value: string | undefined): value is DocumentKind =>
  (DOCUMENT_KINDS as readonly string[]).includes(value ?? '');

export interface DocumentRow {
  kind: DocumentKind;
  /** Submission, acceptance round or instalment id. */
  docId: string;
  title: string;
  date: string;
  status: string;
  tone: BadgeTone;
  signed: number;
  signatureSlots: number;
  /** False for a 0-đồng settlement: no letter (BR-B7-01, PD-20). */
  printable: boolean;
  note?: string;
}

const PAYMENT_STATUS: Readonly<Record<string, { status: string; tone: BadgeTone }>> = {
  PENDING_APPROVAL: { status: 'Chờ duyệt', tone: 'warn' },
  NEEDS_UPDATE: { status: 'Cần bổ sung', tone: 'warn' },
  PENDING_TRANSFER: { status: 'Đã duyệt', tone: 'good' },
  TRANSFERRED: { status: 'Đã chuyển', tone: 'good' },
};

const ROUND_STATUS: Readonly<Record<string, { status: string; tone: BadgeTone }>> = {
  PENDING: { status: 'Đang nghiệm thu', tone: 'warn' },
  PASSED: { status: 'Đạt', tone: 'good' },
  FAILED: { status: 'Không đạt', tone: 'crit' },
};

export const NO_LETTER_NOTE = 'Không cần thư đề nghị: số của đợt bằng 0';

type SubmissionLike = NonNullable<RecordDetail['quoteProposal']>['submissions'][number];

/** Outcome of one submission: approved by the last step, refused, sent back, or still waiting. */
export const submissionStatus = (
  submission: SubmissionLike,
  approvedSubmissionId: string | undefined,
): { status: string; tone: BadgeTone; isApproved: boolean } => {
  if (approvedSubmissionId === submission.id) return { status: 'Đã duyệt', tone: 'good', isApproved: true };
  if (submission.decisions.some((decision) => decision.outcome === 'REJECTED')) return { status: 'Bị từ chối', tone: 'crit', isApproved: false };
  if (submission.decisions.some((decision) => decision.outcome === 'NEEDS_UPDATE')) return { status: 'Cần bổ sung', tone: 'warn', isApproved: false };
  return { status: 'Chờ duyệt', tone: 'warn', isApproved: false };
};

/** BOARD-step decision of a submission (its signature fills the BQT block). */
export const boardDecisionOf = (submission: SubmissionLike) =>
  submission.decisions.find((decision) => decision.stepKey === 'BOARD' && decision.outcome !== 'NEEDS_UPDATE');

const hasSignature = (submission: SubmissionLike, documentId: string | undefined): boolean =>
  Boolean(documentId && submission.signatures.some((signature) => signature.documentId === documentId));

/** BR-B7-01: every sent submission, acceptance round and instalment, oldest first. Drafts never appear. */
export const buildDocumentList = (detail: RecordDetail): DocumentRow[] => {
  const proposals: DocumentRow[] = (detail.quoteProposal?.submissions ?? []).map((submission) => {
    const outcome = submissionStatus(submission, detail.record.approvedSubmissionId);
    return {
      kind: 'proposal',
      docId: submission.id,
      title: `Tờ trình · lần ${submission.attemptNo}`,
      date: submission.submittedAt,
      status: outcome.status,
      tone: outcome.tone,
      signed: Number(hasSignature(submission, submission.id)) + Number(hasSignature(submission, boardDecisionOf(submission)?.id)),
      signatureSlots: 2,
      printable: true,
    };
  });
  const minutes: DocumentRow[] = (detail.execution?.acceptances ?? []).map((round) => ({
    kind: 'minutes',
    docId: round.id,
    title: `Biên bản nghiệm thu · lượt ${round.roundNo}`,
    date: round.createdAt,
    ...ROUND_STATUS[round.outcome],
    signed: round.decisions.filter((decision) => decision.signatureDataUrl).length,
    signatureSlots: round.memberStepKeys.length,
    printable: true,
  }));
  const letters: DocumentRow[] = (detail.paymentHistory?.payments ?? []).map((payment) => {
    const noLetter = payment.kind === 'QUYET_TOAN' && payment.amountVnd === '0';
    return {
      kind: 'payment',
      docId: payment.id,
      title: `Thư đề nghị · đợt ${payment.seqNo} ${payment.kind === 'TAM_UNG' ? 'tạm ứng' : 'quyết toán'}`,
      date: payment.submittedAt,
      ...(PAYMENT_STATUS[payment.status] ?? { status: payment.status, tone: 'neutral' as BadgeTone }),
      signed: payment.signatureDataUrl ? 1 : 0,
      signatureSlots: 1,
      printable: !noLetter,
      ...(noLetter ? { note: NO_LETTER_NOTE } : {}),
    };
  });
  return [...proposals, ...minutes, ...letters].sort((a, b) => a.date.localeCompare(b.date));
};
