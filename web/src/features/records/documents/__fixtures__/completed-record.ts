import type { AcceptanceRound } from '@/domain/execution';
import type { PaymentInstalment } from '@/domain/payment';
import type { QuoteSubmission } from '@/domain/quote-proposal';
import type { Attachment, RepairRecord } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import type { PrintNames } from '../print-format';

/**
 * The SPEC B7-S1 §4 test record: proposal 1 refused, proposal 2 approved (TVKT then BQT with minutes), acceptance
 * round 1 failed, round 2 passed, an advance of 4 M and a settlement of 10 M. Shared by the document tests.
 */
export const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';

const PEOPLE: Readonly<Record<string, string>> = {
  'usr-bql': 'Nguyễn Thu Hà',
  'usr-tvkt': 'Võ Thanh Tâm',
  'usr-bqt': 'Bùi Hải Yến',
};

export const NAMES: PrintNames = {
  person: (id) => (id ? (PEOPLE[id] ?? '') : ''),
  building: () => 'Tòa A – An Khang Residence',
};

const file = (id: string, purpose: Attachment['purpose']): Attachment => ({
  id,
  subjectType: 'REPAIR_RECORD',
  subjectId: 'rec-1',
  buildingId: 'bld-a',
  purpose,
  fileName: `${id}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 10,
  contentRef: id,
  uploadedBy: 'usr-bql',
  createdAt: '2026-10-20T01:00:00.000Z',
});

const contractor = (name: string, unitPrice: string, tax = '0') => ({
  name,
  unitPricesVnd: [unitPrice],
  otherCostVnd: '0',
  taxVnd: tax,
  quotationAttachmentIds: ['att-quote'],
});

const total = (unitPrice: string, tax = '0') => {
  const line = (BigInt(unitPrice) * 2n).toString();
  return { lineTotalsVnd: [line], subtotalVnd: line, totalVnd: (BigInt(line) + BigInt(tax)).toString() };
};

export const submission = (attemptNo: number, overrides: Partial<QuoteSubmission> = {}): QuoteSubmission => ({
  id: `sub-${attemptNo}`,
  attemptNo,
  content: {
    recipient: 'Ban quản trị tòa Tòa A – An Khang Residence',
    preparedByName: 'Nguyễn Thu Hà',
    proposalType: 'SUA_CHUA',
    budgetSource: 'KINH_PHI_BAO_TRI',
    requestContent: 'Thay đoạn ống cấp nước bị rò ở hành lang tầng 3.',
    assessment: 'Ống cũ đã mục, thay mới cả đoạn và van khóa.',
    desiredApprovalDate: '2026-10-30',
    items: [{ name: 'Ống cấp PPR D25', unit: 'gói', quantity: '2' }],
    contractors: [contractor('Công ty Nam Phát', '5000000', '0')],
    proposedContractorIndex: 0,
    shortfallReason: 'Sự cố gấp.',
    incidentAttachmentIds: ['att-incident'],
    contractorTotals: [total('5000000')],
    reviewerUserId: 'usr-tvkt',
  },
  proposedAmountVnd: '10000000',
  attachmentIds: ['att-incident', 'att-quote'],
  submittedBy: 'usr-bql',
  submittedAt: `2026-10-2${attemptNo}T02:00:00.000Z`,
  decisions: [],
  signatures: [{ id: `sig-sub-${attemptNo}`, documentType: 'PROPOSAL', documentId: `sub-${attemptNo}`, signerId: 'usr-bql', imageDataUrl: SIGNATURE, createdAt: `2026-10-2${attemptNo}T02:00:00.000Z` }],
  ...overrides,
});

const rejected = submission(1, {
  decisions: [
    { id: 'dec-1a', stepKey: 'TECH', actorId: 'usr-tvkt', outcome: 'APPROVED', reason: null, selectedContractorIndex: null, attachmentIds: [], createdAt: '2026-10-21T03:00:00.000Z' },
    { id: 'dec-1b', stepKey: 'BOARD', actorId: 'usr-bqt', outcome: 'REJECTED', reason: 'Báo giá chưa có dấu.', selectedContractorIndex: null, attachmentIds: ['att-minutes-1'], createdAt: '2026-10-21T04:00:00.000Z' },
  ],
  signatures: [
    { id: 'sig-sub-1', documentType: 'PROPOSAL', documentId: 'sub-1', signerId: 'usr-bql', imageDataUrl: SIGNATURE, createdAt: '2026-10-21T02:00:00.000Z' },
    { id: 'sig-dec-1b', documentType: 'BOARD_DECISION', documentId: 'dec-1b', signerId: 'usr-bqt', imageDataUrl: SIGNATURE, createdAt: '2026-10-21T04:00:00.000Z' },
  ],
});

const approved = submission(2, {
  decisions: [
    { id: 'dec-2a', stepKey: 'TECH', actorId: 'usr-tvkt', outcome: 'APPROVED', reason: null, selectedContractorIndex: null, attachmentIds: [], createdAt: '2026-10-22T03:00:00.000Z' },
    { id: 'dec-2b', stepKey: 'BOARD', actorId: 'usr-bqt', outcome: 'APPROVED', reason: null, selectedContractorIndex: 0, attachmentIds: ['att-minutes-2'], createdAt: '2026-10-22T07:02:00.000Z' },
  ],
  signatures: [
    { id: 'sig-sub-2', documentType: 'PROPOSAL', documentId: 'sub-2', signerId: 'usr-bql', imageDataUrl: SIGNATURE, createdAt: '2026-10-22T02:15:00.000Z' },
    { id: 'sig-dec-2b', documentType: 'BOARD_DECISION', documentId: 'dec-2b', signerId: 'usr-bqt', imageDataUrl: SIGNATURE, createdAt: '2026-10-22T07:02:00.000Z' },
  ],
});

const round = (roundNo: number, outcome: AcceptanceRound['outcome'], decisions: AcceptanceRound['decisions']): AcceptanceRound => ({
  id: `acc-${roundNo}`,
  roundNo,
  completedDate: '2026-10-24',
  inspectedAt: `2026-10-2${3 + roundNo}T02:30:00.000Z`,
  inspectionLocation: 'Hành lang tầng 3',
  content: 'Kiểm tra đoạn ống mới, chạy thử áp lực.',
  otherMembers: null,
  photoAttachmentIds: [],
  memberStepKeys: ['MANAGER', 'BOARD', 'TECH'],
  outcome,
  submittedBy: 'usr-bql',
  createdAt: `2026-10-2${3 + roundNo}T02:00:00.000Z`,
  closedAt: outcome === 'PENDING' ? null : `2026-10-2${3 + roundNo}T05:00:00.000Z`,
  decisions,
});

const decision = (stepKey: string, actorId: string, outcome: 'PASSED' | 'FAILED', note: string | null, at: string) => ({
  id: `md-${stepKey}-${at}`,
  stepKey,
  actorId,
  outcome,
  note,
  attachmentIds: [],
  signatureDataUrl: SIGNATURE,
  createdAt: at,
});

export const failedRound = round(1, 'FAILED', [
  decision('MANAGER', 'usr-bql', 'PASSED', null, '2026-10-24T02:41:00.000Z'),
  decision('BOARD', 'usr-bqt', 'FAILED', 'Mối nối còn rò, cần làm lại.', '2026-10-24T02:45:00.000Z'),
]);
export const passedRound = round(2, 'PASSED', [
  decision('MANAGER', 'usr-bql', 'PASSED', null, '2026-10-25T02:41:00.000Z'),
  decision('BOARD', 'usr-bqt', 'PASSED', 'Vệ sinh khu vực sau thi công.', '2026-10-25T02:45:00.000Z'),
  decision('TECH', 'usr-tvkt', 'PASSED', null, '2026-10-25T02:50:00.000Z'),
]);

const payment = (overrides: Partial<PaymentInstalment>): PaymentInstalment => ({
  id: 'pay-1',
  kind: 'TAM_UNG',
  seqNo: 1,
  status: 'TRANSFERRED',
  revisionNo: 1,
  settlementAmountVnd: null,
  amountVnd: '4000000',
  payeeName: 'CONG TY NAM PHAT',
  accountNo: '0123456789',
  bankName: 'Vietcombank',
  transferContent: 'BQT A THANH TOAN CHI PHI SC-014',
  requestAttachmentIds: ['att-req-1'],
  invoiceAttachmentIds: [],
  chainStepKeys: ['BOARD'],
  currentStepKey: null,
  submittedBy: 'usr-bql',
  submittedAt: '2026-10-23T02:00:00.000Z',
  transferDate: '2026-10-23',
  transferReference: 'FT1',
  proofAttachmentIds: [],
  confirmedBy: 'usr-ktoan',
  confirmedAt: '2026-10-23T05:00:00.000Z',
  decisions: [],
  signatureDataUrl: SIGNATURE,
  ...overrides,
});

export const advance = payment({});
export const settlement = payment({
  id: 'pay-2',
  kind: 'QUYET_TOAN',
  seqNo: 2,
  settlementAmountVnd: '10000000',
  amountVnd: '6000000',
  requestAttachmentIds: ['att-req-2'],
  invoiceAttachmentIds: ['att-invoice'],
  submittedAt: '2026-10-26T02:00:00.000Z',
});

export const completedDetail = (overrides: Partial<RecordDetail> = {}): RecordDetail =>
  ({
    record: {
      id: 'rec-1',
      code: 'SC-014',
      buildingId: 'bld-a',
      title: 'Thay ống cấp nước hành lang tầng 3',
      status: 'COMPLETED',
      managerUserId: 'usr-bql',
      approvedSubmissionId: 'sub-2',
      approvalAssigneeUserIds: { TECH: 'usr-tvkt', BOARD: 'usr-bqt' },
      workflowApprovalSteps: [],
    } as unknown as RepairRecord,
    quoteProposal: { draft: null, submissions: [rejected, approved], approvedAmountVnd: '10000000', executingContractorName: 'Công ty Nam Phát' },
    execution: { construction: null, acceptances: [failedRound, passedRound], repairDraft: null },
    paymentHistory: { approvedAmountVnd: '10000000', transferredTotalVnd: '10000000', draft: null, payments: [advance, settlement] },
    attachments: [
      file('att-incident', 'INCIDENT_MINUTES'),
      file('att-quote', 'QUOTATION'),
      file('att-req-1', 'PAYMENT_REQUEST'),
      file('att-req-2', 'PAYMENT_REQUEST'),
      file('att-invoice', 'INVOICE'),
    ],
    ...overrides,
  }) as RecordDetail;
