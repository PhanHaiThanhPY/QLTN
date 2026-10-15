import { LIMITS, PRIORITY } from '@/domain/constants';
import type { Priority } from '@/domain/constants';
import { assertNoFieldErrors, forbidden, invalidTransition, notFound, validationError } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { Attachment, MaintenanceOccurrence, MaintenancePlan, RepairRecord } from '@/domain/types';
import { FieldErrorCollector, asRecord, asString, asStringArray } from '@/domain/validation';
import { OCCURRENCE_FINAL_STATUSES, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { assertLocationScope, assertScopeAndVersion, nextCode, notify, writeAudit } from '../command-context';
import { newId } from '../runtime';
import { commitOccurrence, commitSimple, loadOccurrenceFor } from './maintenance-helpers';
import { approvalStepKeysOf } from '@/domain/building-config';
import { commitRecord, defaultApprovers, isActiveUserInRole } from './repair-helpers';
import { loadBuildingConfig } from './building-handlers';

const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (Object.values(PRIORITY) as string[]).includes(value);

/**
 * Creates a DRAFT repair record from a maintenance occurrence: copies building, location,
 * item, description and photos, and links both ways (spec 8.3).
 */
const createRepairFromMaintenance: CommandHandler = async (ctx, command) => {
  const occurrence = await loadOccurrenceFor(ctx, command, 'createRepairFromMaintenance');
  // Same rule as createRecord: only roles that may edit repair records create one.
  if (!hasCapability(ctx.actor, 'RECORD_EDIT')) throw forbidden('Chỉ BQL được tạo hồ sơ sửa chữa.');
  const payload = asRecord(command.payload);
  const item = await ctx.db.maintenanceItems.get(occurrence.itemId);
  const locationId = asString(payload.locationId) || item?.locationId || '';
  const location = await ctx.db.locations.get(locationId);
  const confirmationUserId = asString(payload.confirmationUserId);
  const approvers = defaultApprovers(ctx, occurrence.buildingId, locationId);
  const photoIds = asStringArray(payload.attachmentIds);
  const errors = new FieldErrorCollector()
    .title('title', 'Tên hồ sơ', payload.title)
    .text('description', 'Mô tả hư hỏng', payload.description, LIMITS.DESCRIPTION_MIN, LIMITS.DESCRIPTION_MAX)
    .when(location?.buildingId !== occurrence.buildingId, 'locationId', 'Vị trí phải thuộc cùng tòa nhà.')
    .when(
      Boolean(location) && !isActiveUserInRole(ctx, ctx.actor.id, 'BQL', occurrence.buildingId, locationId),
      'locationId',
      'Người quản lý không có phạm vi xử lý tại khu vực này.',
    )
    .when(!isPriority(payload.priority), 'priority', 'Mức ưu tiên không hợp lệ.')
    .when(!isActiveUserInRole(ctx, confirmationUserId, 'TECH_CONFIRMER', occurrence.buildingId, locationId), 'confirmationUserId', 'Cần người xác nhận đúng khu vực và còn hoạt động.');
  const sources = await ctx.db.attachments.bulkGet(photoIds);
  const images = sources.filter(
    (row): row is Attachment =>
      Boolean(row) && row?.subjectId === occurrence.id && row.subjectType === 'MAINTENANCE_OCCURRENCE' && row.mimeType.startsWith('image/'),
  );
  errors.when(images.length === 0, 'attachmentIds', 'Cần ít nhất 1 ảnh hư hỏng từ lượt bảo trì.');
  assertNoFieldErrors(errors.errors);

  const recordId = newId('rec');
  const copies: Attachment[] = images.map((image) => ({
    ...image,
    id: newId('att'),
    subjectType: 'REPAIR_RECORD',
    subjectId: recordId,
    purpose: 'SITE_PHOTO',
    uploadedBy: ctx.actor.id,
    createdAt: ctx.now,
  }));
  await ctx.db.attachments.bulkAdd(copies);
  const buildingConfig = await loadBuildingConfig(ctx, occurrence.buildingId);
  const record: RepairRecord = {
    id: recordId,
    code: await nextCode(ctx, 'SC'),
    buildingId: occurrence.buildingId,
    locationId,
    maintenanceItemId: occurrence.itemId,
    sourceMaintenanceOccurrenceId: occurrence.id,
    title: asString(payload.title),
    description: asString(payload.description),
    priority: payload.priority as Priority,
    status: 'DRAFT',
    managerUserId: ctx.actor.id,
    confirmationUserId,
    ...approvers,
    dueDays: buildingConfig.taskDueDays,
    approvalStepKeys: approvalStepKeysOf(buildingConfig.approvalStepKeys),
    attachmentIds: copies.map((copy) => copy.id),
    createdBy: ctx.actor.id,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    version: 1,
  };
  await ctx.db.records.add(record);
  await writeAudit(ctx, {
    subjectType: 'REPAIR_RECORD',
    subjectId: recordId,
    buildingId: record.buildingId,
    action: 'createRepairFromMaintenance',
    toStatus: 'DRAFT',
    entityVersion: 1,
    reason: `Tạo từ lượt bảo trì ${occurrence.code}`,
  });
  await commitOccurrence(
    ctx,
    occurrence,
    { ...occurrence, repairRecordIds: [...occurrence.repairRecordIds, recordId] },
    'createRepairFromMaintenance',
    { reason: `Tạo hồ sơ sửa chữa ${record.code}` },
  );
  return { ok: true, subjectId: recordId, data: { code: record.code } };
};

type ManagedSubject = RepairRecord | MaintenanceOccurrence | MaintenancePlan;

const loadManagedSubject = async (
  ctx: CommandContext,
  subjectType: string,
  subjectId: string,
): Promise<ManagedSubject | undefined> => {
  if (subjectType === 'REPAIR_RECORD') return ctx.db.records.get(subjectId);
  if (subjectType === 'MAINTENANCE_OCCURRENCE') return ctx.db.occurrences.get(subjectId);
  if (subjectType === 'MAINTENANCE_PLAN') return ctx.db.maintenancePlans.get(subjectId);
  return undefined;
};

/** Repair records carry their location; occurrences and plans use their maintenance item's location. */
const subjectLocationId = async (ctx: CommandContext, subject: ManagedSubject): Promise<string | undefined> => {
  if ('locationId' in subject) return subject.locationId || undefined;
  return (await ctx.db.maintenanceItems.get(subject.itemId))?.locationId;
};

/**
 * ADMIN restores assignment when the managing BQL is inactive (spec 7).
 * It never grants ADMIN any approval or confirmation power.
 */
const replaceManager: CommandHandler = async (ctx, command) => {
  if (!hasCapability(ctx.actor, 'REPLACE_MANAGER')) throw forbidden('Chỉ ADMIN được thay BQL quản lý.');
  const payload = asRecord(command.payload);
  const userId = asString(payload.userId);
  const reason = asString(payload.reason);
  const subjectId = command.subjectId ?? '';
  const subject = await loadManagedSubject(ctx, command.subjectType, subjectId);
  assertScopeAndVersion(ctx, subject, command.expectedVersion);
  const current = subject as ManagedSubject;
  const locationId = await subjectLocationId(ctx, current);
  assertLocationScope(ctx, current.buildingId, locationId);
  if (ctx.usersById.get(current.managerUserId)?.active) {
    throw invalidTransition('Chỉ thay BQL quản lý khi người hiện tại đã ngừng hoạt động.');
  }
  const errors = new FieldErrorCollector()
    .reason('reason', reason)
    .when(!isActiveUserInRole(ctx, userId, 'BQL', current.buildingId, locationId), 'userId', 'Cần chọn BQL cùng tòa, đúng khu vực và còn hoạt động.');
  assertNoFieldErrors(errors.errors);

  if (command.subjectType === 'REPAIR_RECORD') {
    const record = current as RepairRecord;
    if (REPAIR_FINAL_STATUSES.includes(record.status)) throw invalidTransition('Hồ sơ đã kết thúc.');
    await commitRecord(ctx, record, { ...record, managerUserId: userId }, 'replaceManager', { reason, closeReason: 'REASSIGNED' });
  } else if (command.subjectType === 'MAINTENANCE_OCCURRENCE') {
    const occurrence = current as MaintenanceOccurrence;
    if (OCCURRENCE_FINAL_STATUSES.includes(occurrence.status)) throw invalidTransition('Lượt đã kết thúc.');
    await commitOccurrence(ctx, occurrence, { ...occurrence, managerUserId: userId }, 'replaceManager', { reason, closeReason: 'REASSIGNED' });
  } else if (command.subjectType === 'MAINTENANCE_PLAN') {
    await commitSimple(ctx, 'MAINTENANCE_PLAN', current as MaintenancePlan, { ...(current as MaintenancePlan), managerUserId: userId }, 'replaceManager', reason);
  } else {
    throw validationError({ subjectType: 'Loại đối tượng không hỗ trợ thay BQL quản lý.' });
  }
  await notify(ctx, {
    subjectType: command.subjectType,
    subjectId,
    buildingId: current.buildingId,
    recipientId: userId,
    title: 'Bạn được giao làm BQL quản lý',
    message: reason,
  });
  return { ok: true, subjectId };
};

/** Marks a notification as read; only the recipient may do it. */
const markNotificationRead: CommandHandler = async (ctx, command) => {
  const ids = asStringArray(asRecord(command.payload).notificationIds);
  const rows = await ctx.db.notifications.bulkGet(ids);
  for (const row of rows) {
    if (!row) throw notFound('Không tìm thấy thông báo.');
    if (row.recipientId !== ctx.actor.id) throw forbidden();
    if (!row.readAt) await ctx.db.notifications.update(row.id, { readAt: ctx.now });
  }
  return { ok: true, data: { count: rows.length } };
};

export const linkAndAssignmentHandlers: Record<string, CommandHandler> = {
  createRepairFromMaintenance,
  replaceManager,
  markNotificationRead,
};
