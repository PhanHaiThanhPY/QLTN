/**
 * Proposal with a quotation table (SPEC B03–B09 v2 §4.1, §4.2), as served by api-qltn. Money is integer VND carried as
 * strings and computed with BigInt; the server recomputes every total, the screen only previews them.
 */

export const PROPOSAL_TYPE_LABEL = {
  SUA_CHUA: 'Sửa chữa',
  THAY_THE: 'Thay thế thiết bị',
  KHAC: 'Khác',
} as const;
export type ProposalType = keyof typeof PROPOSAL_TYPE_LABEL;

export const BUDGET_SOURCE_LABEL = {
  KINH_PHI_BAO_TRI: 'Kinh phí bảo trì phần sở hữu chung',
  KINH_PHI_VAN_HANH: 'Kinh phí vận hành',
  KHAC: 'Khác',
} as const;
export type BudgetSource = keyof typeof BUDGET_SOURCE_LABEL;

export const QUOTE_LIMITS = {
  ITEMS_MAX: 50,
  CONTRACTORS_MAX: 5,
  CONTRACTORS_EXPECTED: 3,
  TEXT_MIN: 10,
  TEXT_MAX: 2000,
  SHORTFALL_MAX: 1000,
  ITEM_NAME_MAX: 200,
  ITEM_UNIT_MAX: 20,
  CONTRACTOR_NAME_MAX: 200,
} as const;

export interface QuoteItem {
  name: string;
  unit: string;
  /** Decimal string, up to 3 decimals ("1.5"). */
  quantity: string;
}

export interface QuoteContractor {
  name: string;
  unitPricesVnd: string[];
  otherCostVnd: string;
  taxVnd: string;
  quotationAttachmentIds: string[];
}

export interface ContractorTotal {
  lineTotalsVnd: string[];
  subtotalVnd: string;
  totalVnd: string;
}

export interface QuoteProposalFields {
  recipient: string;
  preparedByName: string;
  proposalType: ProposalType;
  budgetSource: BudgetSource;
  requestContent: string;
  assessment: string;
  desiredApprovalDate: string | null;
  items: QuoteItem[];
  contractors: QuoteContractor[];
  proposedContractorIndex: number;
  shortfallReason: string;
  incidentAttachmentIds: string[];
}

export type QuoteProposalDraft = Partial<QuoteProposalFields>;

export interface QuoteSubmissionContent extends QuoteProposalFields {
  contractorTotals: ContractorTotal[];
  reviewerUserId: string | null;
}

export type QuoteDecisionOutcome = 'APPROVED' | 'NEEDS_UPDATE' | 'REJECTED';

export interface QuoteDecision {
  id: string;
  stepKey: string;
  actorId: string;
  outcome: QuoteDecisionOutcome;
  reason: string | null;
  selectedContractorIndex: number | null;
  attachmentIds: string[];
  createdAt: string;
}

export interface QuoteSignature {
  id: string;
  documentType: 'PROPOSAL' | 'BOARD_DECISION';
  documentId: string;
  signerId: string;
  imageDataUrl: string;
  createdAt: string;
}

export interface QuoteSubmission {
  id: string;
  attemptNo: number;
  content: QuoteSubmissionContent;
  proposedAmountVnd: string;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: string;
  decisions: QuoteDecision[];
  signatures: QuoteSignature[];
}

export interface QuoteProposalHistory {
  draft: QuoteProposalDraft | null;
  submissions: QuoteSubmission[];
  approvedAmountVnd: string | null;
  executingContractorName: string | null;
}

const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;
const VND_PATTERN = /^(?:0|[1-9]\d{0,14})$/;
const QUANTITY_SCALE = 1000n;

export const isValidQuantity = (value: string): boolean => QUANTITY_PATTERN.test(value) && /[1-9]/.test(value);
export const isValidVnd = (value: string): boolean => VND_PATTERN.test(value);

/** "12.500.000" or "12500000" → "12500000"; empty when no digit. */
export const vndDigits = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const quantityThousandths = (quantity: string): bigint => {
  const [whole, fraction = ''] = quantity.split('.');
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(3, '0'));
};

/** Same rounding as the server: quantity × unit price, half up to the đồng. Invalid input counts as 0. */
export const lineTotalVnd = (quantity: string, unitPriceVnd: string): bigint => {
  if (!isValidQuantity(quantity) || !isValidVnd(unitPriceVnd)) return 0n;
  return (quantityThousandths(quantity) * BigInt(unitPriceVnd) + QUANTITY_SCALE / 2n) / QUANTITY_SCALE;
};

const vndOrZero = (value: string): bigint => (isValidVnd(value) ? BigInt(value) : 0n);

/** Preview of one contractor's totals (Σ lines + other costs + tax). */
export const contractorTotal = (items: readonly QuoteItem[], contractor: QuoteContractor): ContractorTotal => {
  const lines = items.map((item, index) => lineTotalVnd(item.quantity, contractor.unitPricesVnd[index] ?? ''));
  const subtotal = lines.reduce((sum, line) => sum + line, 0n);
  const total = subtotal + vndOrZero(contractor.otherCostVnd) + vndOrZero(contractor.taxVnd);
  return { lineTotalsVnd: lines.map(String), subtotalVnd: subtotal.toString(), totalVnd: total.toString() };
};

const vndFormatter = new Intl.NumberFormat('vi-VN');

/** "3410000" → "3.410.000 ₫"; a missing amount shows a dash. */
export const formatVndString = (value: string | null | undefined): string =>
  value && isValidVnd(value) ? `${vndFormatter.format(BigInt(value))} ₫` : '—';

/** Text box value: "3410000" → "3.410.000". */
export const formatVndInputString = (value: string): string =>
  value && isValidVnd(value) ? vndFormatter.format(BigInt(value)) : '';
