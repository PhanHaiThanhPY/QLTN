import { FieldErrors } from '../../common/validation/field-errors';
import { contractorTotal, QUANTITY_PATTERN, VND_PATTERN, type QuoteItem } from '../../domain/proposal-quote';
import {
  BUDGET_SOURCES,
  PROPOSAL_TYPES,
  type BudgetSource,
  type ProposalContractor,
  type ProposalDraft,
  type ProposalFields,
  type ProposalType,
  type SubmissionContent,
} from './proposal.types';
import { validateText } from './record-loader';

/** Bounds of SPEC B03–B09 v2 §4.1 and §4.2. */
export const PROPOSAL_LIMITS = {
  RECIPIENT_MAX: 200,
  PREPARED_BY_MAX: 200,
  TEXT_MIN: 10,
  TEXT_MAX: 2000,
  ITEMS_MIN: 1,
  ITEMS_MAX: 50,
  ITEM_NAME_MAX: 200,
  ITEM_UNIT_MAX: 20,
  CONTRACTORS_MIN: 1,
  CONTRACTORS_MAX: 5,
  CONTRACTOR_NAME_MAX: 200,
  /** Fewer contractors than this needs a shortfall reason. */
  CONTRACTORS_EXPECTED: 3,
  SHORTFALL_MIN: 10,
  SHORTFALL_MAX: 1000,
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
const isProposalType = (value: string): value is ProposalType => (PROPOSAL_TYPES as readonly string[]).includes(value);
const isBudgetSource = (value: string): value is BudgetSource => (BUDGET_SOURCES as readonly string[]).includes(value);

/** Body fields of T04–T06 as they arrive (arrays stay untyped until checked here). */
export interface ProposalInput {
  recipient?: string;
  preparedByName?: string;
  proposalType?: string;
  budgetSource?: string;
  requestContent?: string;
  assessment?: string;
  desiredApprovalDate?: string | null;
  items?: unknown[];
  contractors?: unknown[];
  proposedContractorIndex?: number;
  shortfallReason?: string;
  incidentAttachmentIds?: string[];
}

const maxLength = (errors: FieldErrors, field: string, label: string, value: string, max: number): void => {
  errors.when(value.length > max, field, `${label} tối đa ${max} ký tự.`);
};

/** Quantity "0" or "0.000" is well formed but not a valid quantity (> 0). */
const isPositiveQuantity = (value: string): boolean => QUANTITY_PATTERN.test(value) && /[1-9]/.test(value);

const parseItems = (errors: FieldErrors, raw: unknown[]): QuoteItem[] => {
  errors.when(raw.length > PROPOSAL_LIMITS.ITEMS_MAX, 'items', `Tối đa ${PROPOSAL_LIMITS.ITEMS_MAX} hạng mục.`);
  return raw.slice(0, PROPOSAL_LIMITS.ITEMS_MAX).map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const item = { name: textOf(row.name), unit: textOf(row.unit), quantity: textOf(row.quantity) };
    maxLength(errors, `items.${index}.name`, 'Tên hạng mục', item.name, PROPOSAL_LIMITS.ITEM_NAME_MAX);
    maxLength(errors, `items.${index}.unit`, 'Đơn vị', item.unit, PROPOSAL_LIMITS.ITEM_UNIT_MAX);
    errors.when(
      item.quantity !== '' && !isPositiveQuantity(item.quantity),
      `items.${index}.quantity`,
      'Số lượng phải lớn hơn 0, tối đa 3 chữ số thập phân.',
    );
    return item;
  });
};

const vndOf = (errors: FieldErrors, field: string, value: unknown): string => {
  const text = textOf(value);
  errors.when(text !== '' && !VND_PATTERN.test(text), field, 'Số tiền phải là số nguyên VND không âm.');
  return text;
};

const parseContractors = (errors: FieldErrors, raw: unknown[]): ProposalContractor[] => {
  errors.when(
    raw.length > PROPOSAL_LIMITS.CONTRACTORS_MAX,
    'contractors',
    `Tối đa ${PROPOSAL_LIMITS.CONTRACTORS_MAX} nhà thầu.`,
  );
  return raw.slice(0, PROPOSAL_LIMITS.CONTRACTORS_MAX).map((entry, index) => {
    const row = isRecord(entry) ? entry : {};
    const field = `contractors.${index}`;
    const name = textOf(row.name);
    maxLength(errors, `${field}.name`, 'Tên nhà thầu', name, PROPOSAL_LIMITS.CONTRACTOR_NAME_MAX);
    const prices = Array.isArray(row.unitPricesVnd) ? row.unitPricesVnd : [];
    return {
      name,
      unitPricesVnd: prices.map((price, line) => vndOf(errors, `${field}.unitPricesVnd.${line}`, price)),
      otherCostVnd: vndOf(errors, `${field}.otherCostVnd`, row.otherCostVnd),
      taxVnd: vndOf(errors, `${field}.taxVnd`, row.taxVnd),
      quotationAttachmentIds: idsOf(row.quotationAttachmentIds),
    };
  });
};

/**
 * T04: merges the fields sent onto the saved draft. Every field stays optional, but a value that is sent must be
 * well formed (SPEC §5.1); completeness is only checked on submission.
 */
export const mergeProposalDraft = (current: ProposalDraft | null, input: ProposalInput): ProposalDraft => {
  const errors = new FieldErrors();
  const draft: ProposalDraft = { ...(current ?? {}) };
  if (input.recipient !== undefined) {
    draft.recipient = textOf(input.recipient);
    maxLength(errors, 'recipient', 'Kính gửi', draft.recipient, PROPOSAL_LIMITS.RECIPIENT_MAX);
  }
  if (input.preparedByName !== undefined) {
    draft.preparedByName = textOf(input.preparedByName);
    maxLength(errors, 'preparedByName', 'Người lập', draft.preparedByName, PROPOSAL_LIMITS.PREPARED_BY_MAX);
  }
  if (input.proposalType !== undefined) {
    if (isProposalType(input.proposalType)) draft.proposalType = input.proposalType;
    else errors.add('proposalType', 'Loại tờ trình không hợp lệ.');
  }
  if (input.budgetSource !== undefined) {
    if (isBudgetSource(input.budgetSource)) draft.budgetSource = input.budgetSource;
    else errors.add('budgetSource', 'Ngân sách không hợp lệ.');
  }
  if (input.requestContent !== undefined) {
    draft.requestContent = textOf(input.requestContent);
    maxLength(errors, 'requestContent', 'Nội dung xin phê duyệt', draft.requestContent, PROPOSAL_LIMITS.TEXT_MAX);
  }
  if (input.assessment !== undefined) {
    draft.assessment = textOf(input.assessment);
    maxLength(errors, 'assessment', 'Đề xuất và đánh giá', draft.assessment, PROPOSAL_LIMITS.TEXT_MAX);
  }
  if (input.desiredApprovalDate !== undefined) {
    const date = textOf(input.desiredApprovalDate);
    errors.when(date !== '' && !DATE_PATTERN.test(date), 'desiredApprovalDate', 'Ngày không hợp lệ.');
    draft.desiredApprovalDate = date || null;
  }
  if (input.items !== undefined) draft.items = parseItems(errors, input.items);
  if (input.contractors !== undefined) draft.contractors = parseContractors(errors, input.contractors);
  if (input.proposedContractorIndex !== undefined) draft.proposedContractorIndex = input.proposedContractorIndex;
  if (input.shortfallReason !== undefined) {
    draft.shortfallReason = textOf(input.shortfallReason);
    maxLength(
      errors,
      'shortfallReason',
      'Lý do không đủ 3 báo giá',
      draft.shortfallReason,
      PROPOSAL_LIMITS.SHORTFALL_MAX,
    );
  }
  if (input.incidentAttachmentIds !== undefined) draft.incidentAttachmentIds = idsOf(input.incidentAttachmentIds);
  errors.throwIfAny();
  return draft;
};

const assertItemsComplete = (errors: FieldErrors, items: readonly QuoteItem[]): void => {
  errors.when(items.length < PROPOSAL_LIMITS.ITEMS_MIN, 'items', 'Cần ít nhất 1 hạng mục.');
  items.forEach((item, index) => {
    errors.when(!item.name, `items.${index}.name`, 'Cần tên hạng mục.');
    errors.when(!item.unit, `items.${index}.unit`, 'Cần đơn vị.');
    errors.when(!isPositiveQuantity(item.quantity), `items.${index}.quantity`, 'Số lượng phải lớn hơn 0.');
  });
};

const assertContractorsComplete = (
  errors: FieldErrors,
  contractors: readonly ProposalContractor[],
  itemCount: number,
): void => {
  errors.when(contractors.length < PROPOSAL_LIMITS.CONTRACTORS_MIN, 'contractors', 'Cần ít nhất 1 nhà thầu.');
  contractors.forEach((contractor, index) => {
    const field = `contractors.${index}`;
    errors.when(!contractor.name, `${field}.name`, 'Cần tên nhà thầu.');
    errors.when(
      contractor.unitPricesVnd.length !== itemCount,
      `${field}.unitPricesVnd`,
      'Cần đơn giá cho từng hạng mục.',
    );
    contractor.unitPricesVnd.forEach((price, line) =>
      errors.when(!VND_PATTERN.test(price), `${field}.unitPricesVnd.${line}`, 'Cần đơn giá (số nguyên VND).'),
    );
    errors.when(!VND_PATTERN.test(contractor.otherCostVnd), `${field}.otherCostVnd`, 'Cần chi phí khác (có thể là 0).');
    errors.when(!VND_PATTERN.test(contractor.taxVnd), `${field}.taxVnd`, 'Cần tiền thuế (có thể là 0).');
    errors.when(
      contractor.quotationAttachmentIds.length === 0,
      `${field}.quotationAttachmentIds`,
      'Cần ít nhất 1 tệp báo giá.',
    );
  });
};

/** Defaults the screen shows prefilled (§4.1): "Kính gửi" and "Người lập". */
export interface ProposalDefaults {
  recipient: string;
  preparedByName: string;
}

/**
 * BR-S2-01 field checks on the merged draft (all errors at once). Returns the submission content with the
 * server-computed totals; client totals are never read (§4.2).
 */
export const completeProposal = (
  draft: ProposalDraft,
  defaults: ProposalDefaults,
  reviewerUserId: string | null,
): SubmissionContent => {
  const errors = new FieldErrors();
  const items = draft.items ?? [];
  const contractors = draft.contractors ?? [];
  const fields: ProposalFields = {
    recipient: draft.recipient || defaults.recipient,
    preparedByName: draft.preparedByName || defaults.preparedByName,
    proposalType: draft.proposalType ?? 'SUA_CHUA',
    budgetSource: draft.budgetSource ?? 'KINH_PHI_BAO_TRI',
    requestContent: draft.requestContent ?? '',
    assessment: draft.assessment ?? '',
    desiredApprovalDate: draft.desiredApprovalDate ?? null,
    items,
    contractors,
    proposedContractorIndex: draft.proposedContractorIndex ?? -1,
    shortfallReason: draft.shortfallReason ?? '',
    incidentAttachmentIds: draft.incidentAttachmentIds ?? [],
  };
  errors.when(!draft.proposalType, 'proposalType', 'Chọn loại tờ trình.');
  errors.when(!draft.budgetSource, 'budgetSource', 'Chọn ngân sách.');
  validateText(
    errors,
    'requestContent',
    'Nội dung xin phê duyệt',
    fields.requestContent,
    PROPOSAL_LIMITS.TEXT_MIN,
    PROPOSAL_LIMITS.TEXT_MAX,
  );
  validateText(
    errors,
    'assessment',
    'Đề xuất và đánh giá',
    fields.assessment,
    PROPOSAL_LIMITS.TEXT_MIN,
    PROPOSAL_LIMITS.TEXT_MAX,
  );
  assertItemsComplete(errors, items);
  assertContractorsComplete(errors, contractors, items.length);
  if (contractors.length < PROPOSAL_LIMITS.CONTRACTORS_EXPECTED) {
    validateText(
      errors,
      'shortfallReason',
      'Lý do không đủ 3 báo giá',
      fields.shortfallReason,
      PROPOSAL_LIMITS.SHORTFALL_MIN,
      PROPOSAL_LIMITS.SHORTFALL_MAX,
    );
  }
  const index = fields.proposedContractorIndex;
  errors.when(
    !Number.isInteger(index) || index < 0 || index >= contractors.length,
    'proposedContractorIndex',
    'Chọn đúng 1 nhà thầu đề xuất.',
  );
  errors.when(fields.incidentAttachmentIds.length === 0, 'incidentAttachmentIds', 'Cần biên bản ghi nhận sự việc.');
  errors.throwIfAny();
  return {
    ...fields,
    contractorTotals: contractors.map((contractor) => contractorTotal(items, contractor)),
    reviewerUserId,
  };
};
