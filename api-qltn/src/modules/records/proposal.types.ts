import type { ContractorTotal, QuoteContractor, QuoteItem } from '../../domain/proposal-quote';

/** Proposal type and budget source of D5-TT (SPEC B03–B09 v2 §4.1; the form leaves them blank, values assumed). */
export const PROPOSAL_TYPES = ['SUA_CHUA', 'THAY_THE', 'KHAC'] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];
export const BUDGET_SOURCES = ['KINH_PHI_BAO_TRI', 'KINH_PHI_VAN_HANH', 'KHAC'] as const;
export type BudgetSource = (typeof BUDGET_SOURCES)[number];

export interface ProposalContractor extends QuoteContractor {
  /** Quotation files of this contractor (purpose QUOTATION, at least one when submitting). */
  quotationAttachmentIds: string[];
}

/** Every field a submission needs (§4.1, §4.2). */
export interface ProposalFields {
  recipient: string;
  preparedByName: string;
  proposalType: ProposalType;
  budgetSource: BudgetSource;
  requestContent: string;
  assessment: string;
  desiredApprovalDate: string | null;
  items: QuoteItem[];
  contractors: ProposalContractor[];
  proposedContractorIndex: number;
  /** Required when fewer than 3 contractors quote. */
  shortfallReason: string;
  /** "Biên bản ghi nhận sự việc" (purpose INCIDENT_MINUTES, at least one when submitting). */
  incidentAttachmentIds: string[];
}

/** What the manager saves while preparing (T04): any subset. */
export type ProposalDraft = Partial<ProposalFields>;

/** Immutable content of one submission (BR-S2-02): the fields plus what the system computed or resolved. */
export interface SubmissionContent extends ProposalFields {
  contractorTotals: ContractorTotal[];
  /** "Thẩm định nội dung": holder of the first TVKT step of the chain, if any. */
  reviewerUserId: string | null;
}
