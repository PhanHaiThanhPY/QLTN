import { approvalStepOf, approvalStepsFor, nextApprovalStep } from '@/domain/actions';
import type { ApprovalStep } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import type { RepairStatus } from '@/domain/constants';
import { assertNoFieldErrors, conflict, invalidTransition, notFound, validationError } from '@/domain/errors';
import type { ApprovalOutcome, ProposalDraft, RepairRecord, SignatureKind, Submission } from '@/domain/types';
import { FieldErrorCollector, asNumber, asOptionalString, asRecord, asString, asStringArray, requireVndAmount } from '@/domain/validation';
import type { Command, CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import { approverErrors, assertOwnAttachments, commitRecord, loadRecordFor } from './repair-helpers';
import { createUnresolvedNotice } from './unresolved-notice-handlers';

const hasValue = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

/** Saves the proposal draft; amount is optional while drafting but must be valid when given. */
const upsertDraft = async (ctx: CommandContext, record: RepairRecord, payload: Record<string, unknown>): Promise<ProposalDraft> => {
  const current = await ctx.db.proposalDrafts.where('recordId').equals(record.id).first();
  const contractorName = asString(payload.contractorName);
  const errors = new FieldErrorCollector();
  errors.when(contractorName.length > LIMITS.CONTRACTOR_NAME_MAX, 'contractorName', `Tên nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.`);
  if (hasValue(payload.amountVnd)) errors.amount('amountVnd', payload.amountVnd);
  assertNoFieldErrors(errors.errors);
  const attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'REPAIR_RECORD', record.id, 'attachmentIds', ['PROPOSAL']);
  const draft: ProposalDraft = {
    id: current?.id ?? newId('pdr'),
    recordId: record.id,
    proposal: asString(payload.proposal),
    contractorName,
    amountVnd: hasValue(payload.amountVnd) ? asNumber(payload.amountVnd) : undefined,
    attachmentIds,
    version: (current?.version ?? 0) + 1,
    updatedAt: ctx.now,
  };
  await ctx.db.proposalDrafts.put(draft);
  return draft;
};

const saveProposalDraft: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'saveProposalDraft');
  await upsertDraft(ctx, record, asRecord(command.payload));
  // Bumps the record version so a stale tab cannot submit an outdated draft.
  await commitRecord(ctx, record, record, 'saveProposalDraft');
  return { ok: true, subjectId: record.id };
};

const addSignature = async (ctx: CommandContext, submission: Submission, kind: SignatureKind, imageDataUrl: string): Promise<void> => {
  await ctx.db.signatures.add({
    id: newId('sig'),
    recordId: submission.recordId,
    submissionId: submission.id,
    attemptNo: submission.attemptNo,
    kind,
    actorId: ctx.actor.id,
    imageDataUrl,
    signedAt: ctx.now,
  });
};

/** Creates an immutable submission snapshot from the current draft (spec 5.4); the submitter signs it. */
const createSubmission = async (
  ctx: CommandContext,
  record: RepairRecord,
  draft: ProposalDraft,
  signature: unknown,
): Promise<Submission> => {
  const errors = new FieldErrorCollector()
    .signature('signature', signature)
    .text('proposal', 'Phương án', draft.proposal, LIMITS.PROPOSAL_MIN, LIMITS.DESCRIPTION_MAX)
    .required('contractorName', draft.contractorName, 'Cần tên nhà thầu thực hiện.')
    .amount('amountVnd', draft.amountVnd);
  errors.when(draft.attachmentIds.length === 0, 'attachmentIds', 'Cần tài liệu tờ trình.');
  for (const [field, message] of Object.entries(approverErrors(ctx, record))) errors.add(field, message);
  assertNoFieldErrors(errors.errors);
  const amountVnd = requireVndAmount(draft.amountVnd, 'amountVnd');

  const previous = await ctx.db.submissions.where('recordId').equals(record.id).count();
  const attemptNo = previous + 1;
  if (attemptNo > LIMITS.MAX_SUBMISSION_ATTEMPTS) {
    throw invalidTransition(`Đã đạt tối đa ${LIMITS.MAX_SUBMISSION_ATTEMPTS} lần trình.`);
  }
  const submission: Submission = {
    id: newId('sub'),
    recordId: record.id,
    attemptNo,
    proposal: draft.proposal,
    contractorName: draft.contractorName,
    amountVnd,
    attachmentIds: [...draft.attachmentIds],
    submittedBy: ctx.actor.id,
    submittedAt: ctx.now,
  };
  await ctx.db.submissions.add(submission);
  await addSignature(ctx, submission, 'SUBMITTER', signature as string);
  return submission;
};

/** Emergency documents submitted late need a reason (proposal 2.5); records the submission time. */
const emergencyAfterSubmit = (ctx: CommandContext, record: RepairRecord, payload: Record<string, unknown>): RepairRecord['emergency'] => {
  const emergency = record.emergency;
  if (!emergency || record.status !== 'EMERGENCY_IN_PROGRESS') return emergency;
  const isLate = ctx.now > emergency.docsDueAt;
  const lateReason = asString(payload.lateReason);
  if (isLate) assertNoFieldErrors(new FieldErrorCollector().reason('lateReason', lateReason, 'Lý do bổ sung trễ hạn').errors);
  return { ...emergency, docsSubmittedAt: ctx.now, lateReason: isLate ? lateReason : undefined };
};

/** Every submission (first or resubmitted) starts the chain again at TVKT. */
const submitHandler =
  (action: 'submitProposal' | 'resubmitProposal'): CommandHandler =>
  async (ctx, command) => {
    const record = await loadRecordFor(ctx, command, action);
    const payload = asRecord(command.payload);
    const { signature, lateReason: _lateReason, ...fields } = payload;
    void _lateReason;
    const draft = Object.keys(fields).length > 0
      ? await upsertDraft(ctx, record, fields)
      : await ctx.db.proposalDrafts.where('recordId').equals(record.id).first();
    if (!draft) throw validationError({ proposal: 'Chưa có phương án/tờ trình.' });
    const emergency = emergencyAfterSubmit(ctx, record, payload);
    const submission = await createSubmission(ctx, record, draft, signature);
    const firstStep = approvalStepsFor(record.approvalStepKeys)[0];
    await commitRecord(ctx, record, { ...record, status: firstStep.status, currentSubmissionId: submission.id, emergency }, action);
    return { ok: true, subjectId: record.id, data: { submissionId: submission.id, attemptNo: submission.attemptNo } };
  };

interface DecisionTarget {
  record: RepairRecord;
  submission: Submission;
  step: ApprovalStep;
}

/** Loads the record, its current submission and the approval step waiting on the actor. */
const loadDecision = async (
  ctx: CommandContext,
  command: Command,
  action: 'approveProposal' | 'requestProposalUpdate' | 'rejectProposal',
): Promise<DecisionTarget> => {
  const record = await loadRecordFor(ctx, command, action);
  const submission = record.currentSubmissionId ? await ctx.db.submissions.get(record.currentSubmissionId) : undefined;
  if (!submission) throw notFound('Không tìm thấy lần trình hiện hành.');
  if (submission.submittedBy === ctx.actor.id) throw invalidTransition('Người lập tờ trình không được tự duyệt.');
  const expectedSubmissionId = asOptionalString(asRecord(command.payload).submissionId);
  if (expectedSubmissionId && expectedSubmissionId !== submission.id) throw conflict('Lần trình đã thay đổi. Vui lòng tải lại.');
  const step = approvalStepOf(record.status, record.approvalStepKeys);
  if (!step) throw invalidTransition('Hồ sơ không ở bước duyệt tờ trình.');
  return { record, submission, step };
};

const recordDecision = async (ctx: CommandContext, target: DecisionTarget, outcome: ApprovalOutcome, reason?: string) => {
  await ctx.db.approvalDecisions.add({
    id: newId('apd'),
    submissionId: target.submission.id,
    recordId: target.record.id,
    step: target.step.key,
    actorId: ctx.actor.id,
    outcome,
    reason,
    createdAt: ctx.now,
  });
};

/**
 * Status after the last approval step. An emergency repair already has its construction under way,
 * so it goes straight back to IN_CONSTRUCTION (spec 5.2, no "Chờ thi công"); others wait for startConstruction.
 */
const statusAfterFinalApproval = async (ctx: CommandContext, record: RepairRecord): Promise<RepairStatus> => {
  if (!record.emergency) return 'READY_FOR_CONSTRUCTION';
  const construction = await ctx.db.constructions.where('recordId').equals(record.id).first();
  return construction ? 'IN_CONSTRUCTION' : 'READY_FOR_CONSTRUCTION';
};

/** Moves to the next approver; after the last step, the record is ready for (or back in) construction. */
const approveProposal: CommandHandler = async (ctx, command) => {
  const target = await loadDecision(ctx, command, 'approveProposal');
  await recordDecision(ctx, target, 'APPROVED');
  const next = nextApprovalStep(target.step.key, target.record.approvalStepKeys);
  const record: RepairRecord = next
    ? { ...target.record, status: next.status }
    : { ...target.record, status: await statusAfterFinalApproval(ctx, target.record), approvedSubmissionId: target.submission.id };
  await commitRecord(ctx, target.record, record, 'approveProposal', { reason: target.step.label });
  return { ok: true, subjectId: record.id };
};

const requestProposalUpdate: CommandHandler = async (ctx, command) => {
  const target = await loadDecision(ctx, command, 'requestProposalUpdate');
  if (target.submission.attemptNo >= LIMITS.MAX_SUBMISSION_ATTEMPTS) {
    throw invalidTransition('Đây là lần trình thứ 3: chỉ được duyệt hoặc từ chối.');
  }
  const reason = asString(asRecord(command.payload).reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  await recordDecision(ctx, target, 'NEEDS_UPDATE', reason);
  await commitRecord(ctx, target.record, { ...target.record, status: 'NEEDS_SUBMISSION_UPDATE' }, 'requestProposalUpdate', { reason });
  return { ok: true, subjectId: target.record.id };
};

/** A rejection at any step counts as one attempt; the third rejection marks the record unresolved. */
const rejectProposal: CommandHandler = async (ctx, command) => {
  const target = await loadDecision(ctx, command, 'rejectProposal');
  const reason = asString(asRecord(command.payload).reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  await recordDecision(ctx, target, 'REJECTED', reason);
  const isLast = target.submission.attemptNo >= LIMITS.MAX_SUBMISSION_ATTEMPTS;
  if (!isLast) {
    await commitRecord(ctx, target.record, { ...target.record, status: 'REJECTED_RESUBMITTABLE' }, 'rejectProposal', { reason });
    return { ok: true, subjectId: target.record.id };
  }
  // Third rejection: the record becomes "Chưa xử lý" and the system drafts a notice with the reasons (proposal 2.4).
  const saved = await commitRecord(ctx, target.record, { ...target.record, status: 'UNRESOLVED' }, 'rejectProposal', { reason });
  await createUnresolvedNotice(ctx, saved);
  return { ok: true, subjectId: saved.id };
};

export const repairProposalHandlers: Record<string, CommandHandler> = {
  saveProposalDraft,
  submitProposal: submitHandler('submitProposal'),
  resubmitProposal: submitHandler('resubmitProposal'),
  approveProposal,
  requestProposalUpdate,
  rejectProposal,
};
