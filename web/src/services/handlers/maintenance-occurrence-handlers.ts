import { CHECK_RESULT, LIMITS } from '@/domain/constants';
import type { CheckResult, ItemCondition } from '@/domain/constants';
import { assertNoFieldErrors, conflict, notFound, validationError } from '@/domain/errors';
import type { MaintenanceChecklistEntry, MaintenanceOccurrence, MaintenanceSubmission } from '@/domain/types';
import { FieldErrorCollector, asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import type { CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import { listScheduleSlots } from '@/domain/schedule';
import { addDays } from '@/utils/date';
import { buildOccurrence } from './maintenance-generation';
import { applyItemCondition, isItemCondition } from './maintenance-item-handlers';
import { commitOccurrence, loadOccurrenceFor } from './maintenance-helpers';
import { assertOwnAttachments, isActiveUserInRole } from './repair-helpers';
import { needsIssueResolution } from '@/domain/maintenance-rules';

const isCheckResult = (value: unknown): value is CheckResult =>
  typeof value === 'string' && (Object.values(CHECK_RESULT) as string[]).includes(value);

/** Applies working-copy changes: answers only, never adds/removes checklist items (spec 6.4). */
const applyProgress = async (
  ctx: CommandContext,
  occurrence: MaintenanceOccurrence,
  payload: Record<string, unknown>,
): Promise<MaintenanceOccurrence> => {
  const next: MaintenanceOccurrence = { ...occurrence, checklist: occurrence.checklist.map((entry) => ({ ...entry })) };
  if (Array.isArray(payload.checklist)) {
    for (const raw of payload.checklist.map(asRecord)) {
      const entry = next.checklist.find((row) => row.templateItemId === asString(raw.templateItemId));
      if (!entry) throw validationError({ checklist: 'Không thể thêm mục ngoài checklist của lượt.' });
      if ('result' in raw) {
        if (!isCheckResult(raw.result)) throw validationError({ checklist: 'Kết quả kiểm tra không hợp lệ.' });
        entry.result = raw.result;
      }
      if ('note' in raw) entry.note = asOptionalString(raw.note);
      if ('attachmentIds' in raw) {
        entry.attachmentIds = await assertOwnAttachments(ctx, asStringArray(raw.attachmentIds), 'MAINTENANCE_OCCURRENCE', occurrence.id, 'checklist');
      }
    }
  }
  if ('resultNote' in payload) next.resultNote = asOptionalString(payload.resultNote);
  if ('performerName' in payload) next.performerName = asOptionalString(payload.performerName);
  if ('contractorName' in payload) {
    const contractorName = asOptionalString(payload.contractorName);
    if ((contractorName ?? '').length > LIMITS.CONTRACTOR_NAME_MAX) {
      throw validationError({ contractorName: `Tên nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.` });
    }
    next.contractorName = contractorName;
  }
  if ('attachmentIds' in payload) {
    next.attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'MAINTENANCE_OCCURRENCE', occurrence.id, 'attachmentIds');
  }
  return next;
};

const assertSubmittable = async (ctx: CommandContext, occurrence: MaintenanceOccurrence): Promise<void> => {
  const errors = new FieldErrorCollector()
    .reason('resultNote', occurrence.resultNote, 'Kết luận')
    .required('performerName', occurrence.performerName, 'Cần ghi đơn vị thực hiện.');
  occurrence.checklist.forEach((entry, index) => {
    errors.when(entry.required && entry.result === 'NOT_CHECKED', `checklist.${index}`, `Mục bắt buộc “${entry.label}” chưa được kiểm tra.`);
    const needsNote = entry.result === 'ISSUE' || entry.result === 'NOT_APPLICABLE';
    errors.when(needsNote && !entry.note?.trim(), `checklist.${index}`, `Mục “${entry.label}” cần ghi chú lý do.`);
  });
  const ids = [...occurrence.attachmentIds, ...occurrence.checklist.flatMap((entry) => entry.attachmentIds)];
  const rows = await ctx.db.attachments.bulkGet(ids);
  errors.when(!rows.some((row) => row?.mimeType.startsWith('image/')), 'attachmentIds', 'Cần ít nhất 1 ảnh kết quả.');
  assertNoFieldErrors(errors.errors);
};

/** Recreates the period under the current schedule version when it also produces that date. */
const regenerateReleasedPeriod = async (ctx: CommandContext, occurrence: MaintenanceOccurrence): Promise<void> => {
  const plan = await ctx.db.maintenancePlans.get(occurrence.planId);
  const date = occurrence.originalScheduledDate;
  if (!plan || plan.status !== 'ACTIVE' || !date) return;
  const [slot] = listScheduleSlots(plan.scheduleVersions, addDays(date, -1), date);
  if (!slot || slot.date !== date || (plan.generatedThrough && date > plan.generatedThrough)) return;
  const replacement = await buildOccurrence(ctx, plan, date, 'SCHEDULED', slot.revision);
  await commitOccurrence(ctx, null, replacement, 'generateOccurrences', { reason: `Thay cho ${occurrence.code} sau khi đổi chu kỳ` });
};

const startMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'startMaintenance');
  const item = await ctx.db.maintenanceItems.get(occurrence.itemId);
  if (!isActiveUserInRole(ctx, occurrence.confirmationUserId, 'TECH_CONFIRMER', occurrence.buildingId, item?.locationId)) {
    throw validationError({ confirmationUserId: 'Người xác nhận đã ngừng hoạt động. Cần phân công lại trước khi bắt đầu.' });
  }
  await commitOccurrence(ctx, occurrence, { ...occurrence, status: 'IN_PROGRESS', startedAt: ctx.now }, 'startMaintenance');
  return { ok: true, subjectId: occurrence.id };
};

const saveMaintenanceProgress: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'saveMaintenanceProgress');
  const next = await applyProgress(ctx, occurrence, asRecord(command.payload));
  await commitOccurrence(ctx, occurrence, next, 'saveMaintenanceProgress');
  return { ok: true, subjectId: occurrence.id };
};

const submitMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'submitMaintenance');
  const next = await applyProgress(ctx, occurrence, asRecord(command.payload));
  await assertSubmittable(ctx, next);
  const rounds = await ctx.db.maintenanceSubmissions.where('occurrenceId').equals(occurrence.id).count();
  const submission: MaintenanceSubmission = {
    id: newId('msb'),
    occurrenceId: occurrence.id,
    roundNo: rounds + 1,
    checklistSnapshot: next.checklist.map((entry): MaintenanceChecklistEntry => ({ ...entry, attachmentIds: [...entry.attachmentIds] })),
    resultNote: next.resultNote ?? '',
    performerName: next.performerName ?? '',
    contractorName: next.contractorName,
    attachmentIds: [...next.attachmentIds],
    submittedBy: ctx.actor.id,
    submittedAt: ctx.now,
  };
  await ctx.db.maintenanceSubmissions.add(submission);
  await commitOccurrence(ctx, occurrence, { ...next, status: 'PENDING_REVIEW', currentSubmissionId: submission.id }, 'submitMaintenance');
  return { ok: true, subjectId: occurrence.id, data: { roundNo: submission.roundNo } };
};

const currentSubmission = async (
  ctx: CommandContext,
  occurrence: MaintenanceOccurrence,
  expectedId: string | undefined,
): Promise<MaintenanceSubmission> => {
  const submission = occurrence.currentSubmissionId ? await ctx.db.maintenanceSubmissions.get(occurrence.currentSubmissionId) : undefined;
  if (!submission) throw notFound('Không tìm thấy bản gửi hiện hành.');
  if (expectedId && expectedId !== submission.id) throw conflict('Bản gửi đã thay đổi. Vui lòng tải lại.');
  return submission;
};

const requestMaintenanceRework: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'requestMaintenanceRework');
  const payload = asRecord(command.payload);
  const submission = await currentSubmission(ctx, occurrence, asOptionalString(payload.submissionId));
  const reason = asString(payload.reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  await ctx.db.maintenanceReviews.add({
    id: newId('mrv'),
    occurrenceId: occurrence.id,
    submissionId: submission.id,
    roundNo: submission.roundNo,
    actorId: ctx.actor.id,
    outcome: 'REWORK',
    reason,
    createdAt: ctx.now,
  });
  await commitOccurrence(ctx, occurrence, { ...occurrence, status: 'REWORK' }, 'requestMaintenanceRework', { reason });
  return { ok: true, subjectId: occurrence.id };
};

const confirmMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'confirmMaintenance');
  const payload = asRecord(command.payload);
  const submission = await currentSubmission(ctx, occurrence, asOptionalString(payload.submissionId));
  const resolution = asString(payload.issueResolutionNote);
  const condition = payload.itemCondition;
  const conditionNote = asString(payload.conditionNote);
  const errors = new FieldErrorCollector();
  errors.when(
    needsIssueResolution(submission.checklistSnapshot, occurrence.repairRecordIds.length) && resolution.length < LIMITS.REASON_MIN,
    'issueResolutionNote',
    'Chưa đủ hồ sơ sửa chữa liên kết cho các mục “Có vấn đề”: cần ghi hướng xử lý phần còn lại.',
  );
  if (condition !== undefined && condition !== '') {
    errors.when(!isItemCondition(condition), 'itemCondition', 'Tình trạng không hợp lệ.');
    errors.reason('conditionNote', conditionNote, 'Ghi chú tình trạng');
  }
  assertNoFieldErrors(errors.errors);
  const itemConditionAfter = isItemCondition(condition) ? condition : undefined;
  await ctx.db.maintenanceReviews.add({
    id: newId('mrv'),
    occurrenceId: occurrence.id,
    submissionId: submission.id,
    roundNo: submission.roundNo,
    actorId: ctx.actor.id,
    outcome: 'CONFIRMED',
    reason: resolution || undefined,
    itemConditionAfter,
    createdAt: ctx.now,
  });
  if (itemConditionAfter) {
    await applyItemCondition(ctx, occurrence.itemId, itemConditionAfter as ItemCondition, conditionNote, 'confirmMaintenanceCondition');
  }
  await commitOccurrence(ctx, occurrence, { ...occurrence, status: 'COMPLETED', completedAt: ctx.now }, 'confirmMaintenance', {
    reason: resolution || undefined,
  });
  return { ok: true, subjectId: occurrence.id };
};

const rescheduleMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'rescheduleMaintenance');
  const payload = asRecord(command.payload);
  const scheduledDate = asString(payload.scheduledDate);
  const reason = asString(payload.reason);
  const errors = new FieldErrorCollector().date('scheduledDate', scheduledDate, 'Ngày mới').reason('reason', reason);
  errors.when(!errors.errors.scheduledDate && scheduledDate < ctx.today, 'scheduledDate', 'Ngày mới không được trước hôm nay.');
  errors.when(scheduledDate === occurrence.scheduledDate, 'scheduledDate', 'Ngày mới trùng ngày hiện tại.');
  assertNoFieldErrors(errors.errors);
  // originalScheduledDate and scheduleKey stay unchanged, so generation never recreates the period.
  await commitOccurrence(ctx, occurrence, { ...occurrence, scheduledDate }, 'rescheduleMaintenance', { reason });
  return { ok: true, subjectId: occurrence.id };
};

const acknowledgeScheduleChange: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'acknowledgeScheduleChange');
  if (occurrence.reviewFlag !== 'SCHEDULE_CHANGED') throw validationError({ reviewFlag: 'Lượt này không cần rà soát.' });
  await commitOccurrence(ctx, occurrence, { ...occurrence, reviewFlag: undefined }, 'acknowledgeScheduleChange');
  return { ok: true, subjectId: occurrence.id };
};

const cancelMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'cancelMaintenance');
  const reason = asString(asRecord(command.payload).reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  const isScheduleReplaced = occurrence.reviewFlag === 'SCHEDULE_CHANGED' && occurrence.occurrenceKind === 'SCHEDULED';
  await commitOccurrence(
    ctx,
    occurrence,
    {
      ...occurrence,
      status: 'CANCELLED',
      cancelReason: reason,
      reviewFlag: undefined,
      // A period replaced by a new schedule version releases its key so that version can use the date.
      scheduleKey: isScheduleReplaced ? undefined : occurrence.scheduleKey,
    },
    'cancelMaintenance',
    { reason, closeReason: 'CANCELLED' },
  );
  if (isScheduleReplaced) await regenerateReleasedPeriod(ctx, occurrence);
  return { ok: true, subjectId: occurrence.id };
};

const reassignMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'reassignMaintenance');
  const item = await ctx.db.maintenanceItems.get(occurrence.itemId);
  const payload = asRecord(command.payload);
  const userId = asString(payload.userId);
  const reason = asString(payload.reason);
  const errors = new FieldErrorCollector()
    .reason('reason', reason)
    .when(asString(payload.slot) !== 'confirmer', 'slot', 'Chỉ giao lại người xác nhận của lượt.')
    .when(!isActiveUserInRole(ctx, userId, 'TECH_CONFIRMER', occurrence.buildingId, item?.locationId), 'userId', 'Người được chọn phải đúng vai trò, đúng khu vực và còn hoạt động.')
    .when(userId === occurrence.confirmationUserId, 'userId', 'Người được chọn đang là người được giao.');
  assertNoFieldErrors(errors.errors);
  await commitOccurrence(ctx, occurrence, { ...occurrence, confirmationUserId: userId }, 'reassignMaintenance', {
    reason,
    closeReason: 'REASSIGNED',
  });
  return { ok: true, subjectId: occurrence.id };
};

export const maintenanceOccurrenceHandlers: Record<string, CommandHandler> = {
  startMaintenance,
  saveMaintenanceProgress,
  submitMaintenance,
  requestMaintenanceRework,
  confirmMaintenance,
  rescheduleMaintenance,
  acknowledgeScheduleChange,
  cancelMaintenance,
  reassignMaintenance,
};
