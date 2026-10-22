import { assertNoFieldErrors, conflict, invalidTransition, notFound, validationError } from '@/domain/errors';
import { APPROVAL_STEP_SLOT, approvalStepsFor, nextApprovalStep } from '@/domain/actions';
import type { Acceptance, AcceptanceReviewer, Construction, PaymentRequest, RepairRecord } from '@/domain/types';
import { FieldErrorCollector, asNumber, asRecord, asString, asStringArray } from '@/domain/validation';
import type { CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import { assertOwnAttachments, commitRecord, loadRecordFor } from './repair-helpers';

const getConstruction = async (ctx: CommandContext, record: RepairRecord): Promise<Construction> => {
  const construction = await ctx.db.constructions.where('recordId').equals(record.id).first();
  if (!construction) throw notFound('Chưa có dữ liệu thi công.');
  return construction;
};

const RESULT_PURPOSES = ['ACCEPTANCE', 'CONSTRUCTION'] as const;

const ownImages = async (ctx: CommandContext, record: RepairRecord, ids: string[], field: string, message: string) => {
  const unique = await assertOwnAttachments(ctx, ids, 'REPAIR_RECORD', record.id, field, RESULT_PURPOSES);
  const rows = await ctx.db.attachments.bulkGet(unique);
  if (!rows.some((row) => row?.mimeType.startsWith('image/'))) throw validationError({ [field]: message });
  return unique;
};

const startConstruction: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'startConstruction');
  const payload = asRecord(command.payload);
  const startDate = asString(payload.startDate);
  const plannedEndDate = asString(payload.plannedEndDate);
  const errors = new FieldErrorCollector()
    .date('startDate', startDate, 'Ngày bắt đầu')
    .date('plannedEndDate', plannedEndDate, 'Ngày dự kiến hoàn thành');
  errors.when(errors.isEmpty && plannedEndDate < startDate, 'plannedEndDate', 'Ngày dự kiến hoàn thành không được trước ngày bắt đầu.');
  assertNoFieldErrors(errors.errors);
  const existing = await ctx.db.constructions.where('recordId').equals(record.id).count();
  if (existing > 0) throw conflict('Hồ sơ đã có dữ liệu thi công. Vui lòng tải lại.');
  await ctx.db.constructions.add({ id: newId('con'), recordId: record.id, startDate, plannedEndDate, progressPercent: 0, logs: [] });
  await commitRecord(ctx, record, { ...record, status: 'IN_CONSTRUCTION' }, 'startConstruction');
  return { ok: true, subjectId: record.id };
};

const updateConstruction: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'updateConstruction');
  const construction = await getConstruction(ctx, record);
  const payload = asRecord(command.payload);
  const progress = asNumber(payload.progressPercent);
  const note = asString(payload.note);
  const errors = new FieldErrorCollector().reason('note', note, 'Nhật ký thi công');
  errors.when(progress === undefined || !Number.isInteger(progress) || progress < 0 || progress > 100, 'progressPercent', 'Tiến độ là số nguyên từ 0 đến 100.');
  assertNoFieldErrors(errors.errors);
  const attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'REPAIR_RECORD', record.id, 'attachmentIds', ['CONSTRUCTION']);
  await ctx.db.constructions.put({
    ...construction,
    progressPercent: progress as number,
    logs: [
      ...construction.logs,
      { id: newId('clg'), actorId: ctx.actor.id, note, progressPercent: progress as number, attachmentIds, createdAt: ctx.now },
    ],
  });
  await commitRecord(ctx, record, record, 'updateConstruction');
  return { ok: true, subjectId: record.id };
};

const addAcceptanceRound = async (
  ctx: CommandContext,
  record: RepairRecord,
  submissionNote: string,
  attachmentIds: string[],
): Promise<void> => {
  const rounds = await ctx.db.acceptances.where('recordId').equals(record.id).count();
  const acceptance: Acceptance = {
    id: newId('acc'),
    recordId: record.id,
    roundNo: rounds + 1,
    submittedBy: ctx.actor.id,
    submittedAt: ctx.now,
    submissionNote,
    result: 'PENDING',
    checks: [],
    attachmentIds,
  };
  await ctx.db.acceptances.add(acceptance);
};

/** Both KT and TVKT review every acceptance round. */
const ACCEPTANCE_REVIEWERS: AcceptanceReviewer[] = ['confirmer', 'consultant'];

const acceptanceStepKeysOf = (record: RepairRecord): string[] =>
  record.workflowStageApprovalStepKeys?.ACCEPTANCE ?? ['TECH_CONFIRM', 'TECH'];

const isSequentialAcceptance = (record: RepairRecord): boolean => {
  const keys = acceptanceStepKeysOf(record);
  return keys.length !== 2 || keys.some((key, index) => key !== ['TECH_CONFIRM', 'TECH'][index]);
};

const paymentStepKeysOf = (record: RepairRecord): string[] =>
  record.workflowStageApprovalStepKeys?.PAYMENT ?? ['BOARD'];

const legacyAcceptanceSlotsOf = (keys: readonly string[]): AcceptanceReviewer[] =>
  keys.map((key) => APPROVAL_STEP_SLOT[key]).filter((slot): slot is AcceptanceReviewer => slot === 'confirmer' || slot === 'consultant');

const acceptanceStepsOf = (record: RepairRecord): ReturnType<typeof approvalStepsFor> =>
  approvalStepsFor(record.pendingApprovalStepKeys ?? acceptanceStepKeysOf(record), record.workflowApprovalSteps);

const paymentStepsOf = (record: RepairRecord, request?: PaymentRequest): ReturnType<typeof approvalStepsFor> =>
  approvalStepsFor(request?.approvalStepKeys ?? paymentStepKeysOf(record), record.workflowApprovalSteps);

const actorOwnsStep = (record: RepairRecord, stepKey: string, actorId: string): boolean =>
  record.approvalAssigneeUserIds?.[stepKey] === actorId;

const submitAcceptance: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'submitAcceptance');
  const construction = await getConstruction(ctx, record);
  const payload = asRecord(command.payload);
  const completedDate = asString(payload.completedDate);
  const note = asString(payload.note);
  const errors = new FieldErrorCollector().date('completedDate', completedDate, 'Ngày hoàn thành').reason('note', note, 'Nội dung hoàn thành');
  errors.when(construction.progressPercent !== 100, 'progressPercent', 'Tiến độ phải đạt 100% trước khi gửi nghiệm thu.');
  errors.when(errors.isEmpty && completedDate < construction.startDate, 'completedDate', 'Ngày hoàn thành không được trước ngày bắt đầu.');
  errors.when(errors.isEmpty && completedDate > ctx.today, 'completedDate', 'Ngày hoàn thành không được ở tương lai.');
  assertNoFieldErrors(errors.errors);
  const attachmentIds = await ownImages(ctx, record, asStringArray(payload.attachmentIds), 'attachmentIds', 'Cần ít nhất 1 ảnh kết quả.');
  await ctx.db.constructions.put({ ...construction, completedDate });
  await addAcceptanceRound(ctx, record, note, attachmentIds);
  const keys = acceptanceStepKeysOf(record);
  const steps = approvalStepsFor(keys, record.workflowApprovalSteps);
  const pendingKeys = isSequentialAcceptance(record) ? steps.slice(0, 1).map((step) => step.key) : steps.map((step) => step.key);
  const pendingAcceptanceSlots = legacyAcceptanceSlotsOf(pendingKeys);
  await commitRecord(ctx, record, {
    ...record,
    status: 'PENDING_ACCEPTANCE',
    pendingApprovalStepKeys: pendingKeys,
    pendingAcceptanceSlots,
  }, 'submitAcceptance');
  return { ok: true, subjectId: record.id };
};

const pendingAcceptance = async (ctx: CommandContext, record: RepairRecord): Promise<Acceptance> => {
  const rounds = await ctx.db.acceptances.where('recordId').equals(record.id).sortBy('roundNo');
  const current = rounds[rounds.length - 1];
  if (!current || current.result !== 'PENDING') throw invalidTransition('Không có lượt nghiệm thu đang chờ.');
  return current;
};

/** Reviewer slot the actor holds among those still pending in this round. */
const reviewerOf = (ctx: CommandContext, record: RepairRecord): { stepKey: string; reviewer: AcceptanceReviewer } => {
  if (record.pendingApprovalStepKeys) {
    const step = acceptanceStepsOf(record).find((candidate) => actorOwnsStep(record, candidate.key, ctx.actor.id));
    if (step) {
      const reviewer = APPROVAL_STEP_SLOT[step.key] === 'confirmer' || step.role === 'TECH_CONFIRMER' ? 'confirmer' : 'consultant';
      return { stepKey: step.key, reviewer };
    }
  }
  const pending = record.pendingAcceptanceSlots ?? ACCEPTANCE_REVIEWERS;
  if (pending.includes('confirmer') && record.confirmationUserId === ctx.actor.id) return { stepKey: 'TECH_CONFIRM', reviewer: 'confirmer' };
  return { stepKey: 'TECH', reviewer: 'consultant' };
};

interface AcceptanceOutcome {
  result: Acceptance['result'];
  status: RepairRecord['status'];
  pending?: string[];
}

const acceptanceOutcome = (isPass: boolean, pending: string[]): AcceptanceOutcome => {
  if (!isPass) return { result: 'FAILED', status: 'NEEDS_REPAIR' };
  if (pending.length === 0) return { result: 'PASSED', status: 'PENDING_PAYMENT_REQUEST' };
  return { result: 'PENDING', status: 'PENDING_ACCEPTANCE', pending };
};

/**
 * KT and TVKT decide independently. The round passes only when both pass;
 * a single failure fails the round at once and sends the record to NEEDS_REPAIR.
 * KT must attach the acceptance report when passing; TVKT may attach one.
 */
const decideAcceptance =
  (action: 'passAcceptance' | 'failAcceptance'): CommandHandler =>
  async (ctx, command) => {
    const record = await loadRecordFor(ctx, command, action);
    const acceptance = await pendingAcceptance(ctx, record);
    const payload = asRecord(command.payload);
    const note = asString(payload.note);
    const isPass = action === 'passAcceptance';
    const current = reviewerOf(ctx, record);
    const reviewer = current.reviewer;
    assertNoFieldErrors(new FieldErrorCollector().reason('note', note, isPass ? 'Kết luận nghiệm thu' : 'Nội dung chưa đạt').errors);
    const reportIds = await assertOwnAttachments(ctx, asStringArray(payload.reportAttachmentIds), 'REPAIR_RECORD', record.id, 'reportAttachmentIds', ['ACCEPTANCE']);
    const step = acceptanceStepsOf(record).find((candidate) => candidate.key === current.stepKey);
    const requiresReport = reviewer === 'confirmer' || step?.role === 'TECH_CONFIRMER';
    if (isPass && requiresReport && reportIds.length === 0) {
      throw validationError({ reportAttachmentIds: 'Cần tài liệu biên bản nghiệm thu.' });
    }
    const checks = [
      ...acceptance.checks,
      { reviewer, stepKey: current.stepKey, reviewerLabel: step?.label, actorId: ctx.actor.id, passed: isPass, note, reportAttachmentIds: reportIds, checkedAt: ctx.now },
    ];
    let pending = (record.pendingApprovalStepKeys ?? acceptanceStepKeysOf(record)).filter((key) => key !== current.stepKey);
    if (isSequentialAcceptance(record) && isPass && pending.length === 0) {
      const configured = approvalStepsFor(acceptanceStepKeysOf(record), record.workflowApprovalSteps);
      const next = configured[configured.findIndex((candidate) => candidate.key === current.stepKey) + 1];
      if (next) pending = [next.key];
    }
    const outcome = acceptanceOutcome(isPass, pending);
    await ctx.db.acceptances.put({ ...acceptance, checks, result: outcome.result });
    const next: RepairRecord = {
      ...record,
      status: outcome.status,
      pendingApprovalStepKeys: outcome.pending,
      pendingAcceptanceSlots: outcome.pending ? legacyAcceptanceSlotsOf(outcome.pending) : undefined,
    };
    await commitRecord(ctx, record, next, action, { reason: note });
    return { ok: true, subjectId: record.id };
  };

const saveRepairEvidence: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'saveRepairEvidence');
  const construction = await getConstruction(ctx, record);
  const payload = asRecord(command.payload);
  const attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'REPAIR_RECORD', record.id, 'attachmentIds', RESULT_PURPOSES);
  await ctx.db.constructions.put({ ...construction, repairEvidence: { note: asString(payload.note), attachmentIds, updatedAt: ctx.now } });
  await commitRecord(ctx, record, record, 'saveRepairEvidence');
  return { ok: true, subjectId: record.id };
};

const resubmitAcceptance: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'resubmitAcceptance');
  const construction = await getConstruction(ctx, record);
  const payload = asRecord(command.payload);
  const note = asString(payload.note) || asString(construction.repairEvidence?.note);
  assertNoFieldErrors(new FieldErrorCollector().reason('note', note, 'Nội dung khắc phục').errors);
  const given = asStringArray(payload.attachmentIds);
  const ids = given.length > 0 ? given : (construction.repairEvidence?.attachmentIds ?? []);
  const attachmentIds = await ownImages(ctx, record, ids, 'attachmentIds', 'Cần ít nhất 1 ảnh sau khắc phục.');
  await ctx.db.constructions.put({ ...construction, repairEvidence: undefined });
  await addAcceptanceRound(ctx, record, note, attachmentIds);
  const keys = acceptanceStepKeysOf(record);
  const steps = approvalStepsFor(keys, record.workflowApprovalSteps);
  const pendingKeys = isSequentialAcceptance(record) ? steps.slice(0, 1).map((step) => step.key) : steps.map((step) => step.key);
  await commitRecord(ctx, record, {
    ...record,
    status: 'PENDING_ACCEPTANCE',
    pendingApprovalStepKeys: pendingKeys,
    pendingAcceptanceSlots: legacyAcceptanceSlotsOf(pendingKeys),
  }, 'resubmitAcceptance');
  return { ok: true, subjectId: record.id };
};

const approvedAmount = async (ctx: CommandContext, record: RepairRecord): Promise<number> => {
  const submission = record.approvedSubmissionId ? await ctx.db.submissions.get(record.approvedSubmissionId) : undefined;
  if (!submission) throw invalidTransition('Hồ sơ chưa có lần trình được duyệt.');
  return submission.amountVnd;
};

const savePaymentDraft: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'savePaymentDraft');
  const payload = asRecord(command.payload);
  const hasAmount = payload.amountVnd !== undefined && payload.amountVnd !== null && payload.amountVnd !== '';
  if (hasAmount) assertNoFieldErrors(new FieldErrorCollector().amount('amountVnd', payload.amountVnd).errors);
  const attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'REPAIR_RECORD', record.id, 'attachmentIds', ['PAYMENT_REQUEST']);
  const current = await ctx.db.paymentDrafts.where('recordId').equals(record.id).first();
  await ctx.db.paymentDrafts.put({
    id: current?.id ?? newId('pyd'),
    recordId: record.id,
    amountVnd: asNumber(payload.amountVnd) ?? 0,
    attachmentIds,
    version: (current?.version ?? 0) + 1,
    updatedAt: ctx.now,
  });
  await commitRecord(ctx, record, record, 'savePaymentDraft');
  return { ok: true, subjectId: record.id };
};

const submitPaymentRequest: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'submitPaymentRequest');
  const payload = asRecord(command.payload);
  const draft = await ctx.db.paymentDrafts.where('recordId').equals(record.id).first();
  const amountVnd = asNumber(payload.amountVnd) ?? draft?.amountVnd;
  const ids = 'attachmentIds' in payload ? asStringArray(payload.attachmentIds) : (draft?.attachmentIds ?? []);
  const expected = await approvedAmount(ctx, record);
  const acceptances = await ctx.db.acceptances.where('recordId').equals(record.id).toArray();
  const errors = new FieldErrorCollector().amount('amountVnd', amountVnd);
  errors.when(errors.isEmpty && amountVnd !== expected, 'amountVnd', 'Số tiền đề nghị phải đúng giá trị đã duyệt.');
  errors.when(ids.length === 0, 'attachmentIds', 'Cần tệp đề nghị thanh toán.');
  errors.when(!acceptances.some((row) => row.result === 'PASSED'), 'acceptance', 'Cần biên bản nghiệm thu đạt.');
  assertNoFieldErrors(errors.errors);
  const attachmentIds = await assertOwnAttachments(ctx, ids, 'REPAIR_RECORD', record.id, 'attachmentIds', ['PAYMENT_REQUEST']);
  const revisions = await ctx.db.paymentRequests.where('recordId').equals(record.id).count();
  const request: PaymentRequest = {
    id: newId('prq'),
    recordId: record.id,
    revisionNo: revisions + 1,
    amountVnd: amountVnd as number,
    attachmentIds,
    submittedBy: ctx.actor.id,
    submittedAt: ctx.now,
    approvalStepKeys: paymentStepKeysOf(record),
    currentApprovalStepKey: paymentStepsOf(record)[0]?.key,
    approvalAssigneeUserIds: record.approvalAssigneeUserIds,
    approvalDecisions: [],
  };
  await ctx.db.paymentRequests.add(request);
  const isLegacyBoard = request.approvalStepKeys?.length === 1 && request.approvalStepKeys[0] === 'BOARD';
  await commitRecord(ctx, record, {
    ...record,
    status: isLegacyBoard ? 'PENDING_PAYMENT_APPROVAL' : 'PENDING_CUSTOM_PAYMENT_APPROVAL',
    currentPaymentApprovalStepKey: isLegacyBoard ? undefined : request.currentApprovalStepKey,
  }, 'submitPaymentRequest');
  return { ok: true, subjectId: record.id, data: { paymentRequestId: request.id } };
};

const latestRequest = async (ctx: CommandContext, record: RepairRecord): Promise<PaymentRequest> => {
  const requests = await ctx.db.paymentRequests.where('recordId').equals(record.id).sortBy('revisionNo');
  const latest = requests[requests.length - 1];
  if (!latest) throw notFound('Chưa có đề nghị thanh toán.');
  return latest;
};

const decidePayment =
  (action: 'approvePayment' | 'requestPaymentUpdate'): CommandHandler =>
  async (ctx, command) => {
    const record = await loadRecordFor(ctx, command, action);
    const request = await latestRequest(ctx, record);
    if (request.decision) throw invalidTransition('Đề nghị thanh toán hiện hành đã có quyết định.');
    const isApprove = action === 'approvePayment';
    const reason = asString(asRecord(command.payload).reason);
    if (!isApprove) assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
    const steps = paymentStepsOf(record, request);
    const currentKey = request.currentApprovalStepKey ?? record.currentPaymentApprovalStepKey ?? steps[0]?.key;
    const current = steps.find((step) => step.key === currentKey);
    if (!current) throw invalidTransition('Không xác định được bước duyệt thanh toán hiện tại.');
    const decisions = [
      ...(request.approvalDecisions ?? []),
      { step: current.key, actorId: ctx.actor.id, outcome: isApprove ? 'APPROVED' as const : 'NEEDS_UPDATE' as const, reason: isApprove ? undefined : reason, createdAt: ctx.now },
    ];
    const nextStep = isApprove ? nextApprovalStep(current.key, request.approvalStepKeys ?? paymentStepKeysOf(record), record.workflowApprovalSteps) : undefined;
    if (nextStep) {
      await ctx.db.paymentRequests.put({ ...request, currentApprovalStepKey: nextStep.key, approvalDecisions: decisions, decision: undefined, decidedBy: undefined, decidedAt: undefined, reason: undefined });
      const isLegacyBoard = nextStep.key === 'BOARD' && (request.approvalStepKeys?.length ?? 0) === 1;
      await commitRecord(ctx, record, {
        ...record,
        status: isLegacyBoard ? 'PENDING_PAYMENT_APPROVAL' : 'PENDING_CUSTOM_PAYMENT_APPROVAL',
        currentPaymentApprovalStepKey: isLegacyBoard ? undefined : nextStep.key,
      }, action);
    } else {
      await ctx.db.paymentRequests.put({
        ...request,
        currentApprovalStepKey: undefined,
        approvalDecisions: decisions,
        decision: isApprove ? 'APPROVED' : 'NEEDS_UPDATE',
        decidedBy: ctx.actor.id,
        decidedAt: ctx.now,
        reason: isApprove ? undefined : reason,
      });
      const status = isApprove ? 'PENDING_PAYMENT' : 'NEEDS_PAYMENT_UPDATE';
      await commitRecord(ctx, record, { ...record, status, currentPaymentApprovalStepKey: undefined }, action, { reason: isApprove ? undefined : reason });
    }
    return { ok: true, subjectId: record.id };
  };

const recordPayment: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'recordPayment');
  const request = await latestRequest(ctx, record);
  if (request.decision !== 'APPROVED') throw invalidTransition('Đề nghị thanh toán chưa được duyệt.');
  const existing = await ctx.db.payments.where('paymentRequestId').equals(request.id).count();
  if (existing > 0) throw invalidTransition('Đề nghị này đã được ghi nhận thanh toán (demo chỉ thanh toán một lần).');
  const payload = asRecord(command.payload);
  const paidDate = asString(payload.paidDate);
  const reference = asString(payload.reference);
  const amountVnd = asNumber(payload.amountVnd);
  const errors = new FieldErrorCollector()
    .amount('amountVnd', amountVnd)
    .date('paidDate', paidDate, 'Ngày thanh toán')
    .required('reference', reference, 'Cần mã tham chiếu thanh toán.');
  errors.when(errors.isEmpty && paidDate > ctx.today, 'paidDate', 'Ngày thanh toán không được ở tương lai.');
  errors.when(!errors.errors.amountVnd && amountVnd !== request.amountVnd, 'amountVnd', 'Demo chỉ thanh toán một lần đúng đủ số được duyệt.');
  assertNoFieldErrors(errors.errors);
  const ids = asStringArray(payload.attachmentIds);
  if (ids.length === 0) throw validationError({ attachmentIds: 'Cần chứng từ thanh toán.' });
  const attachmentIds = await assertOwnAttachments(ctx, ids, 'REPAIR_RECORD', record.id, 'attachmentIds', ['PAYMENT_PROOF']);
  await ctx.db.payments.add({
    id: newId('pay'),
    paymentRequestId: request.id,
    recordId: record.id,
    amountVnd: amountVnd as number,
    paidDate,
    reference,
    attachmentIds,
    recordedBy: ctx.actor.id,
    createdAt: ctx.now,
  });
  await commitRecord(ctx, record, record, 'recordPayment');
  return { ok: true, subjectId: record.id };
};

const completeRecord: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'completeRecord');
  const expected = await approvedAmount(ctx, record);
  const [payments, acceptances] = await Promise.all([
    ctx.db.payments.where('recordId').equals(record.id).toArray(),
    ctx.db.acceptances.where('recordId').equals(record.id).toArray(),
  ]);
  const paid = payments.reduce((sum, payment) => sum + payment.amountVnd, 0);
  const errors = new FieldErrorCollector()
    .when(paid !== expected, 'payment', 'Chưa ghi nhận thanh toán đủ số được duyệt.')
    .when(!acceptances.some((row) => row.result === 'PASSED'), 'acceptance', 'Chưa có nghiệm thu đạt.');
  assertNoFieldErrors(errors.errors);
  await commitRecord(ctx, record, { ...record, status: 'COMPLETED' }, 'completeRecord');
  return { ok: true, subjectId: record.id };
};

export const repairExecutionHandlers: Record<string, CommandHandler> = {
  startConstruction,
  updateConstruction,
  submitAcceptance,
  passAcceptance: decideAcceptance('passAcceptance'),
  failAcceptance: decideAcceptance('failAcceptance'),
  saveRepairEvidence,
  resubmitAcceptance,
  savePaymentDraft,
  submitPaymentRequest,
  approvePayment: decidePayment('approvePayment'),
  requestPaymentUpdate: decidePayment('requestPaymentUpdate'),
  recordPayment,
  completeRecord,
};
