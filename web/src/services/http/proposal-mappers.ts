import { AppError, ERROR_CODE } from '@/domain/errors';
import type {
  QuoteContractor,
  QuoteItem,
  QuoteProposalDraft,
  QuoteProposalHistory,
  QuoteSubmission,
} from '@/domain/quote-proposal';
import { asRecord, asString, asStringArray } from '@/domain/validation';
import { MISSING_VERSION_MESSAGE } from './version';


/** `proposal` of `GET /records/:id` (S2): the working draft and every immutable submission. */
export interface ApiProposalHistory {
  draft: QuoteProposalDraft | null;
  submissions: readonly QuoteSubmission[];
}

/** Server JSON already matches the web shape; arrays are copied so screens never mutate the query cache. */
export const mapProposalHistory = (
  row: ApiProposalHistory | undefined,
  record: { approvedAmountVnd?: string | null; executingContractorName?: string | null },
): QuoteProposalHistory => ({
  draft: row?.draft ?? null,
  submissions: (row?.submissions ?? []).map((submission) => ({
    ...submission,
    attachmentIds: [...submission.attachmentIds],
    decisions: submission.decisions.map((decision) => ({ ...decision, attachmentIds: [...decision.attachmentIds] })),
    signatures: [...submission.signatures],
  })),
  approvedAmountVnd: record.approvedAmountVnd ?? null,
  executingContractorName: record.executingContractorName ?? null,
});

/** Body of T04–T06; only the keys the screen sends are forwarded (a partial draft keeps the other fields). */
export interface ApiProposalBody {
  version: number;
  recipient?: string;
  preparedByName?: string;
  proposalType?: string;
  budgetSource?: string;
  requestContent?: string;
  assessment?: string;
  desiredApprovalDate?: string | null;
  items?: QuoteItem[];
  contractors?: QuoteContractor[];
  proposedContractorIndex?: number;
  shortfallReason?: string;
  incidentAttachmentIds?: string[];
  signature?: string;
  /** B06-S1 BR-E-05: first submission of an emergency record after its deadline. */
  lateReason?: string;
}

const TEXT_KEYS = [
  'recipient',
  'preparedByName',
  'proposalType',
  'budgetSource',
  'requestContent',
  'assessment',
  'shortfallReason',
] as const;

const requireVersion = (expectedVersion: number | undefined): number => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return expectedVersion;
};

/** Web `saveProposalDraft` / `submitProposal` / `resubmitProposal` payload → `SaveProposalDraftDto` / `SubmitProposalDto`. */
export const toProposalBody = (payload: unknown, expectedVersion: number | undefined): ApiProposalBody => {
  const row = asRecord(payload);
  const body: ApiProposalBody = { version: requireVersion(expectedVersion) };
  for (const key of TEXT_KEYS) {
    if (row[key] !== undefined) body[key] = asString(row[key]);
  }
  if (row.desiredApprovalDate !== undefined) body.desiredApprovalDate = asString(row.desiredApprovalDate) || null;
  if (Array.isArray(row.items)) body.items = row.items as QuoteItem[];
  if (Array.isArray(row.contractors)) body.contractors = row.contractors as QuoteContractor[];
  if (typeof row.proposedContractorIndex === 'number') body.proposedContractorIndex = row.proposedContractorIndex;
  if (row.incidentAttachmentIds !== undefined) body.incidentAttachmentIds = asStringArray(row.incidentAttachmentIds);
  if (row.signature !== undefined) body.signature = asString(row.signature);
  if (typeof row.lateReason === 'string' && row.lateReason.trim() !== '') body.lateReason = row.lateReason;
  return body;
};

export interface ApiProposalDecisionBody {
  version: number;
  submissionId?: string;
  reason?: string;
  signature?: string;
  boardMinutesAttachmentIds?: string[];
  selectedContractorIndex?: number;
  selectionReason?: string;
  /** B06-S1 BR-E-07: the BOARD holder ends the post-review of an emergency record. */
  finalPostReview?: boolean;
}

/** Web `approveProposal` / `requestProposalUpdate` / `rejectProposal` payload → the decision DTOs. */
export const toProposalDecisionBody = (
  payload: unknown,
  expectedVersion: number | undefined,
): ApiProposalDecisionBody => {
  const row = asRecord(payload);
  const body: ApiProposalDecisionBody = { version: requireVersion(expectedVersion) };
  for (const key of ['submissionId', 'reason', 'signature', 'selectionReason'] as const) {
    const value = row[key];
    if (typeof value === 'string' && value !== '') body[key] = value;
  }
  if (row.boardMinutesAttachmentIds !== undefined) {
    body.boardMinutesAttachmentIds = asStringArray(row.boardMinutesAttachmentIds);
  }
  if (typeof row.selectedContractorIndex === 'number') body.selectedContractorIndex = row.selectedContractorIndex;
  if (row.finalPostReview === true) body.finalPostReview = true;
  return body;
};
