import { BUDGET_SOURCE_LABEL, PROPOSAL_TYPE_LABEL, type QuoteSubmission } from '@/domain/quote-proposal';
import type { RecordDetail } from '@/services/records-service';
import { boardDecisionOf, submissionStatus } from './document-list';
import { formDateLine, orDots, printDate, printVnd, type PrintNames, type PrintSignature } from './print-format';

/** The form's quotation table has 3 contractor columns; 4–5 contractors continue in a second table (§3.1). */
export const CONTRACTORS_PER_TABLE = 3;

/** "Cơ sở xin phê duyệt", copied from `Số tờ trình.docx`. */
export const LEGAL_BASIS =
  'Căn cứ vào Điều 34 và Điều 37, Thông tư số 05/2024/TT-BXD, Thông tư quy định chi tiết một số điều của Luật Nhà ở 2023; Ban hành quy chế quản lý, sử dụng Nhà Chung cư, quy định về Các hạng mục của Nhà Chung cư được sử dụng Kinh phí Bảo trì phần sở hữu chung để bảo trì và quy định về sử dụng Kinh phí Bảo trì phần sở hữu chung của Nhà Chung cư có nhiều Chủ Sở hữu.';
export const INCIDENT_BASIS = 'Căn cứ theo biên bản ghi nhận sự việc (đính kèm)';
export const QUOTATION_BASIS = 'Theo đó, Ban Quản lý đã làm việc với các đơn vị để báo giá và đánh giá lựa chọn';
export const OTHER_SUPPLIER_NOTE = 'BQT có thể lựa chọn đơn vị cung cấp khác phù hợp với chi phí của tòa.';
export const NOTES_INTRO =
  'Để đảm bảo tốt quy trình vận hành và hạng mục hệ thống chung của tòa nhà hoạt động ổn định. BQL kính đề nghị BQT phê duyệt chi phí thay thế thiết bị hệ thống trên trước ngày';
export const CLOSING = 'Kính trình Ban Quản trị xem xét và phê duyệt hạng mục nêu trên để Ban Quản lý phối hợp thực hiện.';

export interface QuoteTableContractor {
  name: string;
  unitPrices: string[];
  lineTotals: string[];
  subtotal: string;
  tax: string;
  total: string;
}

export interface QuoteTable {
  items: Array<{ name: string; unit: string; quantity: string }>;
  contractors: QuoteTableContractor[];
}

export interface ProposalPrintModel {
  title: string;
  isApproved: boolean;
  fields: Array<{ label: string; value: string }>;
  recordTitle: string;
  requestContent: string;
  hasIncidentMinutes: boolean;
  hasQuotations: boolean;
  tables: QuoteTable[];
  proposalLine: string;
  assessment: string;
  desiredDate: string;
  boardOpinion: string;
  buildingName: string;
  boardSignature: PrintSignature | null;
  boardDateLine: string;
  managerSignature: PrintSignature | null;
  managerDateLine: string;
}

/** Quotation of a submission split into tables of at most 3 contractors, each repeating the item columns. */
export const quoteTables = (submission: Pick<QuoteSubmission, 'content'>): QuoteTable[] => {
  const { items, contractors, contractorTotals } = submission.content;
  const columns: QuoteTableContractor[] = contractors.map((contractor, index) => {
    const totals = contractorTotals[index];
    return {
      name: contractor.name,
      unitPrices: items.map((_, line) => printVnd(contractor.unitPricesVnd[line])),
      lineTotals: items.map((_, line) => printVnd(totals?.lineTotalsVnd[line])),
      subtotal: printVnd(totals?.subtotalVnd),
      tax: printVnd(contractor.taxVnd),
      total: printVnd(totals?.totalVnd),
    };
  });
  const tables: QuoteTable[] = [];
  for (let start = 0; start < Math.max(columns.length, 1); start += CONTRACTORS_PER_TABLE) {
    tables.push({ items: items.map((item) => ({ ...item })), contractors: columns.slice(start, start + CONTRACTORS_PER_TABLE) });
  }
  return tables;
};

/** "Ý KIẾN CỦA BAN QUẢN TRỊ": the refusal or update reason, else the reason for another contractor, else dots. */
const boardOpinionOf = (submission: QuoteSubmission): string => {
  const sentBack = submission.decisions.find((decision) => decision.outcome !== 'APPROVED' && decision.reason);
  if (sentBack) return orDots(sentBack.reason);
  const otherContractor = submission.decisions.find((decision) => decision.outcome === 'APPROVED' && decision.reason);
  return orDots(otherContractor?.reason);
};

const signatureOf = (submission: QuoteSubmission, documentId: string | undefined, names: PrintNames): PrintSignature | null => {
  const row = documentId ? submission.signatures.find((signature) => signature.documentId === documentId) : undefined;
  return row ? { imageDataUrl: row.imageDataUrl, signerName: names.person(row.signerId), signedAt: row.createdAt } : null;
};

/** §3.1: the fields of `Số tờ trình.docx` filled from one submission. */
export const buildProposalModel = (detail: RecordDetail, submission: QuoteSubmission, names: PrintNames): ProposalPrintModel => {
  const { content } = submission;
  const record = detail.record;
  const proposed = content.contractors[content.proposedContractorIndex];
  const proposedTotal = content.contractorTotals[content.proposedContractorIndex]?.totalVnd;
  const purposes = new Set(detail.attachments.filter((file) => submission.attachmentIds.includes(file.id)).map((file) => file.purpose));
  const board = boardDecisionOf(submission);
  const boardSignature = signatureOf(submission, board?.id, names);
  const managerSignature = signatureOf(submission, submission.id, names);
  return {
    title: `Tờ trình lần ${submission.attemptNo}`,
    isApproved: submissionStatus(submission, record.approvedSubmissionId).isApproved,
    fields: [
      { label: 'Kính gửi', value: orDots(content.recipient) },
      { label: 'Người trình', value: orDots(names.person(submission.submittedBy)) },
      { label: 'Ngày trình', value: printDate(submission.submittedAt) },
      { label: 'Người làm tờ trình', value: orDots(content.preparedByName) },
      { label: 'Lần trình thứ', value: String(submission.attemptNo) },
      { label: 'Thẩm định nội dung', value: orDots(content.reviewerUserId ? names.person(content.reviewerUserId) : null) },
      { label: 'Ngân sách', value: orDots(BUDGET_SOURCE_LABEL[content.budgetSource]) },
      { label: 'Loại tờ trình', value: orDots(PROPOSAL_TYPE_LABEL[content.proposalType]) },
    ],
    recordTitle: orDots(record.title),
    requestContent: orDots(content.requestContent),
    hasIncidentMinutes: purposes.has('INCIDENT_MINUTES') || content.incidentAttachmentIds.length > 0,
    hasQuotations: purposes.has('QUOTATION') || content.contractors.some((contractor) => contractor.quotationAttachmentIds.length > 0),
    tables: quoteTables(submission),
    proposalLine: `Kính trình Ban Quản Trị phê duyệt chi phí ${orDots(record.title)} do đơn vị ${orDots(proposed?.name)} thực hiện với chi phí: ${printVnd(proposedTotal)} VNĐ (đã bao gồm VAT)`,
    assessment: orDots(content.assessment),
    desiredDate: printDate(content.desiredApprovalDate),
    boardOpinion: boardOpinionOf(submission),
    buildingName: names.building(record.buildingId).toUpperCase(),
    boardSignature,
    boardDateLine: boardSignature ? formDateLine(boardSignature.signedAt) : 'Ngày … tháng … năm …',
    managerSignature,
    managerDateLine: formDateLine(submission.submittedAt),
  };
};
