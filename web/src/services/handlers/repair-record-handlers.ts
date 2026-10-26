import { DEFAULT_PROPOSAL_STEP_KEYS, LIMITS, PRIORITY } from '@/domain/constants';
import type { Priority } from '@/domain/constants';
import { assertNoFieldErrors, forbidden, validationError } from '@/domain/errors';
import { APPROVER_SLOTS, SLOT_FIELD, SLOT_ROLE, hasCapability } from '@/domain/permissions';
import type { AssigneeSlot } from '@/domain/permissions';
import { RECORD_ITEM_LINK, RECORD_ITEM_REQUIRED_MESSAGE, recordItemLink } from '@/domain/record-item-link';
import type { RepairConfirmationOutcome, RepairRecord } from '@/domain/types';
import { FieldErrorCollector, asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import type { Command, CommandHandler } from '../command-engine';
import { assertBuildingScope, nextCode, writeAudit } from '../command-context';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import {
  BOARD_FALLBACK_REASON,
  approverErrors,
  assertOwnAttachments,
  commitRecord,
  defaultConfirmerOf,
  defaultWorkflowApprovers,
  defaultApprovers,
  intakeStepOf,
  isActiveUserInRole,
  isValidConfirmer,
  loadRecordFor,
} from './repair-helpers';
import { loadBuildingConfig } from './building-handlers';
import { workflowApprovalDefinitionsOf, workflowApprovalStepsOf, workflowStageApprovalStepKeysOf } from '@/domain/building-config';

const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (Object.values(PRIORITY) as string[]).includes(value);

/** Slots chosen on the record form; the manager is always the creator. */
const FORM_SLOTS: readonly AssigneeSlot[] = ['confirmer', ...APPROVER_SLOTS];

/** Applies editable draft fields after validating references stay inside the record's building. */
const applyDraftFields = async (
  ctx: CommandContext,
  record: RepairRecord,
  payload: Record<string, unknown>,
): Promise<RepairRecord> => {
  const errors = new FieldErrorCollector();
  const next: RepairRecord = { ...record };

  if ('title' in payload) {
    const title = asString(payload.title);
    errors.when(title.length > LIMITS.TITLE_MAX, 'title', `Tên hồ sơ tối đa ${LIMITS.TITLE_MAX} ký tự.`);
    next.title = title;
  }
  if ('description' in payload) {
    const description = asString(payload.description);
    errors.when(description.length > LIMITS.DESCRIPTION_MAX, 'description', `Mô tả tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`);
    next.description = description;
  }
  if ('priority' in payload) {
    errors.when(!isPriority(payload.priority), 'priority', 'Mức ưu tiên không hợp lệ.');
    if (isPriority(payload.priority)) next.priority = payload.priority;
  }
  if ('locationId' in payload) {
    const locationId = asString(payload.locationId);
    if (locationId) {
      const location = await ctx.db.locations.get(locationId);
      errors.when(!location || location.buildingId !== record.buildingId, 'locationId', 'Vị trí phải thuộc tòa nhà của hồ sơ.');
      errors.when(location?.active === false && location.id !== record.locationId, 'locationId', 'Vị trí đã ngừng dùng.');
    }
    next.locationId = locationId;
  }
  errors.when(Boolean(next.locationId) && !isActiveUserInRole(ctx, record.managerUserId, 'BQL', record.buildingId, next.locationId), 'locationId', 'Người quản lý không có phạm vi xử lý tại khu vực này.');
  if ('maintenanceItemId' in payload) {
    const itemId = asOptionalString(payload.maintenanceItemId);
    const item = itemId ? await ctx.db.maintenanceItems.get(itemId) : undefined;
    errors.when(Boolean(itemId) && item?.buildingId !== record.buildingId, 'maintenanceItemId', 'Hạng mục phải thuộc cùng tòa nhà.');
    next.maintenanceItemId = itemId;
    // Choosing an item replaces "Không thuộc thiết bị cụ thể".
    if (itemId) next.noMaintenanceItem = undefined;
  }
  if ('noMaintenanceItem' in payload) {
    const noItem = payload.noMaintenanceItem === true;
    errors.when(noItem && Boolean(asOptionalString(payload.maintenanceItemId)), 'maintenanceItemId', 'Chọn một thiết bị hoặc “Không thuộc thiết bị cụ thể”, không chọn cả hai.');
    next.noMaintenanceItem = noItem ? true : undefined;
    if (noItem) next.maintenanceItemId = undefined;
  }
  // Unchanged values are accepted after the draft stage; only a real change must go through "Giao lại".
  for (const slot of FORM_SLOTS) {
    const field = SLOT_FIELD[slot];
    if (!(field in payload)) continue;
    const userId = asString(payload[field]);
    if (record.status !== 'DRAFT') {
      errors.when(userId !== record[field], field, 'Hồ sơ đã gửi: dùng chức năng “Giao lại” để đổi người xử lý.');
      continue;
    }
    if (!userId) {
      next[field] = '';
      continue;
    }
    // The confirmer follows the record's INTAKE step (BR-07); approvers keep their slot role.
    const valid = slot === 'confirmer'
      ? isValidConfirmer(ctx, userId, intakeStepOf(record), record.buildingId, next.locationId)
      : isActiveUserInRole(ctx, userId, SLOT_ROLE[slot], record.buildingId, next.locationId);
    errors.when(!valid, field, 'Người được chọn phải đúng vai trò, cùng tòa, đúng khu vực và còn hoạt động.');
    next[field] = userId;
  }
  assertNoFieldErrors(errors.errors);
  if ('attachmentIds' in payload) {
    next.attachmentIds = await assertOwnAttachments(ctx, asStringArray(payload.attachmentIds), 'REPAIR_RECORD', record.id, 'attachmentIds');
  }
  return next;
};

/** Full validation before leaving draft (spec 5.4); also guards emergency start. Equipment or "none" is mandatory. */
export const assertSubmittable = async (ctx: CommandContext, record: RepairRecord): Promise<void> => {
  const errors = new FieldErrorCollector()
    .title('title', 'Tên hồ sơ', record.title)
    .text('description', 'Mô tả hư hỏng', record.description, LIMITS.DESCRIPTION_MIN, LIMITS.DESCRIPTION_MAX);
  const location = await ctx.db.locations.get(record.locationId);
  errors.when(!location || location.buildingId !== record.buildingId, 'locationId', 'Vị trí phải thuộc tòa nhà của hồ sơ.');
  errors.when(!isActiveUserInRole(ctx, record.managerUserId, 'BQL', record.buildingId, record.locationId), 'managerUserId', 'BQL quản lý không còn hoạt động hoặc không đúng khu vực.');
  errors.when(!isValidConfirmer(ctx, record.confirmationUserId, intakeStepOf(record), record.buildingId, record.locationId), 'confirmationUserId', 'Người xác nhận đã ngừng hoạt động, sai khu vực hoặc không hợp lệ. Cần phân công lại.');
  for (const [field, message] of Object.entries(approverErrors(ctx, record))) errors.add(field, message);
  const item = record.maintenanceItemId ? await ctx.db.maintenanceItems.get(record.maintenanceItemId) : undefined;
  errors.when(recordItemLink(record) === RECORD_ITEM_LINK.UNLINKED, 'maintenanceItemId', RECORD_ITEM_REQUIRED_MESSAGE);
  errors.when(Boolean(record.maintenanceItemId) && item?.buildingId !== record.buildingId, 'maintenanceItemId', 'Hạng mục phải thuộc cùng tòa nhà.');
  errors.when(item?.buildingId === record.buildingId && !item.active, 'maintenanceItemId', 'Thiết bị/hạng mục đã ngừng sử dụng. Hãy chọn thiết bị khác.');
  errors.when(record.confirmationUserId === record.managerUserId, 'confirmationUserId', 'Người xác nhận phải khác người quản lý.');
  const photos = await ctx.db.attachments.bulkGet(record.attachmentIds);
  const hasPhoto = photos.some((row) => row?.purpose === 'SITE_PHOTO' && row.mimeType.startsWith('image/'));
  errors.when(!hasPhoto, 'attachmentIds', 'Cần ít nhất 1 ảnh hiện trường.');
  assertNoFieldErrors(errors.errors);
};

const createRecord: CommandHandler = async (ctx, command) => {
  const payload = asRecord(command.payload);
  const buildingId = asString(payload.buildingId);
  assertBuildingScope(ctx, buildingId);
  if (!hasCapability(ctx.actor, 'RECORD_EDIT')) throw forbidden('Chỉ BQL được tạo hồ sơ sửa chữa.');

  const id = newId('rec');
  const buildingConfig = await loadBuildingConfig(ctx, buildingId);
  const workflowApprovalSteps = workflowApprovalStepsOf(workflowApprovalDefinitionsOf(buildingConfig.workflowApprovalSteps));
  const workflowStageApprovalStepKeys = workflowStageApprovalStepKeysOf(buildingConfig.workflowStages, buildingConfig.approvalStepKeys);
  const locationId = asString(payload.locationId);
  // BR-07: the INTAKE step's first eligible holder, else BQT (audited).
  const confirmer = defaultConfirmerOf(ctx, intakeStepOf({ workflowStageApprovalStepKeys, workflowApprovalSteps }), buildingId, locationId);
  const base: RepairRecord = {
    id,
    code: await nextCode(ctx, 'SC'),
    buildingId,
    locationId: '',
    title: '',
    description: '',
    priority: 'NORMAL',
    status: 'DRAFT',
    managerUserId: ctx.actor.id,
    confirmationUserId: confirmer.userId,
    ...defaultApprovers(ctx, buildingId, asString(payload.locationId)),
    dueDays: buildingConfig.taskDueDays,
    approvalStepKeys: [...(buildingConfig.approvalStepKeys ?? DEFAULT_PROPOSAL_STEP_KEYS)],
    workflowApprovalSteps,
    workflowStageApprovalStepKeys,
    approvalAssigneeUserIds: defaultWorkflowApprovers(ctx, workflowApprovalSteps, buildingId, asString(payload.locationId)),
    attachmentIds: [],
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    version: 0,
  };
  const { attachmentIds: _ignored, ...requested } = payload;
  void _ignored;
  // An empty confirmer means "theo cấu hình tòa": keep the default picked above.
  const { confirmationUserId: requestedConfirmer, ...rest } = requested;
  const fields = asString(requestedConfirmer) ? requested : rest;
  const filled = await applyDraftFields(ctx, base, { title: '', locationId: '', ...fields });
  const record = { ...filled, version: 1 };
  await ctx.db.records.add(record);
  await writeAudit(ctx, {
    subjectType: 'REPAIR_RECORD',
    subjectId: id,
    buildingId,
    action: 'createRecord',
    toStatus: 'DRAFT',
    entityVersion: 1,
    ...(confirmer.boardFallback && record.confirmationUserId === confirmer.userId ? { reason: BOARD_FALLBACK_REASON } : {}),
  });
  return { ok: true, subjectId: id, data: { code: record.code } };
};

const saveRecordDraft: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'saveRecordDraft');
  const next = await applyDraftFields(ctx, record, asRecord(command.payload));
  const saved = await commitRecord(ctx, record, next, 'saveRecordDraft');
  return { ok: true, subjectId: saved.id };
};

const submitRecord: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'submitRecord');
  const next = await applyDraftFields(ctx, record, asRecord(command.payload));
  await assertSubmittable(ctx, next);
  const saved = await commitRecord(ctx, record, { ...next, status: 'PENDING_CONFIRMATION' }, 'submitRecord');
  return { ok: true, subjectId: saved.id };
};

const withdrawRecord: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'withdrawRecord');
  const reason = asString(asRecord(command.payload).reason);
  assertNoFieldErrors(new FieldErrorCollector().reason('reason', reason).errors);
  await commitRecord(ctx, record, { ...record, status: 'CLOSED_WITHDRAWN' }, 'withdrawRecord', { reason });
  return { ok: true, subjectId: record.id };
};

const confirmationHandler =
  (
    action: 'requestRecordUpdate' | 'confirmRepair' | 'closeNoRepair',
    outcome: RepairConfirmationOutcome,
    target: RepairRecord['status'],
    label: string,
  ): CommandHandler =>
  async (ctx, command: Command) => {
    const record = await loadRecordFor(ctx, command, action);
    const note = asString(asRecord(command.payload).note);
    assertNoFieldErrors(new FieldErrorCollector().reason('note', note, label).errors);
    await ctx.db.repairConfirmations.add({
      id: newId('cfm'),
      recordId: record.id,
      actorId: ctx.actor.id,
      outcome,
      note,
      createdAt: ctx.now,
    });
    await commitRecord(ctx, record, { ...record, status: target }, action, { reason: note });
    return { ok: true, subjectId: record.id };
  };

const isFormSlot = (value: string): value is AssigneeSlot => (FORM_SLOTS as readonly string[]).includes(value);

const reassignRepair: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'reassignRepair');
  const payload = asRecord(command.payload);
  const slot = asString(payload.slot);
  const userId = asString(payload.userId);
  const reason = asString(payload.reason);
  const errors = new FieldErrorCollector().reason('reason', reason);
  if (!isFormSlot(slot)) throw validationError({ slot: 'Chỉ giao lại kỹ thuật xác nhận hoặc người duyệt.' });
  const field = SLOT_FIELD[slot];
  errors.when(!isActiveUserInRole(ctx, userId, SLOT_ROLE[slot], record.buildingId, record.locationId), 'userId', 'Người được chọn phải đúng vai trò, cùng tòa, đúng khu vực và còn hoạt động.');
  errors.when(userId === record[field], 'userId', 'Người được chọn đang là người được giao.');
  errors.when(slot === 'confirmer' && userId === record.managerUserId, 'userId', 'Người xác nhận phải khác người quản lý.');
  assertNoFieldErrors(errors.errors);
  await commitRecord(ctx, record, { ...record, [field]: userId }, 'reassignRepair', { reason, closeReason: 'REASSIGNED' });
  return { ok: true, subjectId: record.id };
};

export const repairRecordHandlers: Record<string, CommandHandler> = {
  createRecord,
  saveRecordDraft,
  submitRecord,
  withdrawRecord,
  requestRecordUpdate: confirmationHandler('requestRecordUpdate', 'NEEDS_UPDATE', 'NEEDS_RECORD_UPDATE', 'Lý do'),
  confirmRepair: confirmationHandler('confirmRepair', 'CONFIRMED', 'PENDING_PROPOSAL', 'Kết luận hiện trạng'),
  closeNoRepair: confirmationHandler('closeNoRepair', 'NO_REPAIR', 'CLOSED_NO_REPAIR', 'Lý do'),
  reassignRepair,
};
