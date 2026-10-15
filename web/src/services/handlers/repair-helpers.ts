import { APPROVAL_STEP_SLOT, REPAIR_ACTIONS, approvalStepsFor, resolveSlots } from '@/domain/actions';
import type { RepairAction } from '@/domain/actions';
import { ATTACHMENT_PURPOSE_LABEL, REPAIR_FINAL_STATUSES, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { AttachmentPurpose, SubjectType, TaskKind } from '@/domain/constants';
import { forbidden, invalidTransition, validationError } from '@/domain/errors';
import { SLOT_ROLE, canAccessLocation, denyReason, slotUserId } from '@/domain/permissions';
import { desiredRepairTasks } from '@/domain/task-rules';
import type { RepairRecord, TaskCompletionReason } from '@/domain/types';
import type { Command } from '../command-engine';
import { assertScopeAndVersion, bumpVersion, dueAtFor, syncTasks, writeAudit } from '../command-context';
import type { CommandContext } from '../command-context';

/** Loads a record and applies scope → version → permission/assignee → source status checks. */
export const loadRecordFor = async (
  ctx: CommandContext,
  command: Command,
  action: RepairAction,
): Promise<RepairRecord> => {
  const record = command.subjectId ? await ctx.db.records.get(command.subjectId) : undefined;
  assertScopeAndVersion(ctx, record, command.expectedVersion);
  const current = record as RepairRecord;
  const def = REPAIR_ACTIONS[action];
  const reason = denyReason(ctx.actor, current, def.capability, resolveSlots(def.slot, current));
  if (reason) throw forbidden(reason);
  if (!(def.from as readonly string[]).includes(current.status)) {
    throw invalidTransition(
      `Không thể “${def.label}” khi hồ sơ đang ở trạng thái “${REPAIR_STATUS_LABEL[current.status]}”.`,
    );
  }
  return current;
};

interface CommitOptions {
  reason?: string;
  closeReason?: TaskCompletionReason;
}

/** Emergency documents are due at the deadline set when work started; other steps use the configuration snapshot. */
const stepDueAt = (ctx: CommandContext, record: RepairRecord, kind: TaskKind): string | undefined =>
  kind === 'SUBMIT_EMERGENCY_DOCS' ? record.emergency?.docsDueAt : dueAtFor(ctx, kind, record.dueDays);

/** Saves a record change: version, due time, audit and task sync in the running transaction. */
export const commitRecord = async (
  ctx: CommandContext,
  before: RepairRecord,
  after: RepairRecord,
  action: string,
  options: CommitOptions = {},
): Promise<RepairRecord> => {
  const desired = desiredRepairTasks(after, ctx.usersById);
  const isFinal = REPAIR_FINAL_STATUSES.includes(after.status);
  const statusChanged = before.status !== after.status;
  const dueAt = desired.length > 0 && statusChanged ? stepDueAt(ctx, after, desired[0].kind) : after.dueAt;
  const next = bumpVersion(ctx, {
    ...after,
    dueAt: desired.length > 0 ? dueAt : undefined,
    closedAt: isFinal ? (after.closedAt ?? ctx.now) : undefined,
  });
  await ctx.db.records.put(next);
  await writeAudit(ctx, {
    subjectType: 'REPAIR_RECORD',
    subjectId: next.id,
    buildingId: next.buildingId,
    action,
    fromStatus: before.status,
    toStatus: next.status,
    entityVersion: next.version,
    reason: options.reason,
  });
  await syncTasks(ctx, {
    subjectType: 'REPAIR_RECORD',
    subjectId: next.id,
    buildingId: next.buildingId,
    desired,
    dueAt: next.dueAt,
    closeReason: options.closeReason ?? (isFinal ? 'CLOSED' : undefined),
    subjectLabel: `${next.code} – ${next.title}`,
  });
  return next;
};

/** Attachment ids must exist on the same subject and building; returns them de-duplicated. */
export const assertOwnAttachments = async (
  ctx: CommandContext,
  ids: string[],
  subjectType: SubjectType,
  subjectId: string,
  field: string,
  purposes?: readonly AttachmentPurpose[],
): Promise<string[]> => {
  const unique = [...new Set(ids)];
  const rows = await ctx.db.attachments.bulkGet(unique);
  const invalid = rows.some((row) => !row || row.subjectType !== subjectType || row.subjectId !== subjectId);
  if (invalid) throw validationError({ [field]: 'Tệp đính kèm không hợp lệ hoặc không thuộc hồ sơ này.' });
  if (purposes && rows.some((row) => row && !purposes.includes(row.purpose))) {
    const expected = purposes.map((purpose) => ATTACHMENT_PURPOSE_LABEL[purpose]).join(' / ');
    throw validationError({ [field]: `Tệp phải thuộc loại: ${expected}.` });
  }
  return unique;
};

export const isActiveUserInRole = (
  ctx: CommandContext,
  userId: string | undefined,
  role: string,
  buildingId: string,
  locationId?: string,
): boolean => {
  const user = userId ? ctx.usersById.get(userId) : undefined;
  if (!user || user.role !== role || !canAccessLocation(user, buildingId, locationId)) return false;
  const rules = ctx.assignmentRulesByBuilding.get(buildingId)?.filter((rule) => rule.role === role) ?? [];
  if (rules.length === 0) return true;
  const matchingRules = rules.filter((rule) => !locationId || !rule.locationIds || rule.locationIds.length === 0 || rule.locationIds.includes(locationId));
  return matchingRules.some((rule) => rule.departmentId === user.departmentId);
};

export const firstActiveInRole = (ctx: CommandContext, role: string, buildingId: string, locationId?: string): string | undefined => {
  const candidates = [...ctx.usersById.values()].filter((user) => user.role === role && canAccessLocation(user, buildingId, locationId));
  const rules = ctx.assignmentRulesByBuilding.get(buildingId)?.filter((rule) => rule.role === role) ?? [];
  if (rules.length === 0) return candidates.sort((a, b) => a.code.localeCompare(b.code)).at(0)?.id;
  const matchingRules = rules
    .filter((rule) => !locationId || !rule.locationIds || rule.locationIds.length === 0 || rule.locationIds.includes(locationId))
    .sort((a, b) => a.priority - b.priority);
  for (const rule of matchingRules) {
    const match = candidates.find((user) => user.departmentId === rule.departmentId);
    if (match) return match.id;
  }
  return undefined;
};

/** Keeps compatibility fields populated while the selected workflow resolves its own slots. */
export const defaultApprovers = (ctx: CommandContext, buildingId: string, locationId?: string): Pick<RepairRecord, 'consultantUserId' | 'boardUserId'> => ({
  consultantUserId: firstActiveInRole(ctx, SLOT_ROLE.consultant, buildingId, locationId) ?? '',
  boardUserId: firstActiveInRole(ctx, SLOT_ROLE.board, buildingId, locationId) ?? '',
});

/** Field errors for every configured approval step whose resolved assignee is invalid. */
export const approverErrors = (ctx: CommandContext, record: RepairRecord): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const [index, step] of approvalStepsFor(record.approvalStepKeys).entries()) {
    const slot = APPROVAL_STEP_SLOT[step.key];
    const userId = slotUserId(record, slot);
    if (!isActiveUserInRole(ctx, userId, step.role, record.buildingId, record.locationId)) {
      errors[`approvalStepKeys.${index}`] = `Người xử lý bước ${step.label} đã ngừng hoạt động hoặc không hợp lệ. Cần kiểm tra lại phân công.`;
    }
  }
  return errors;
};
