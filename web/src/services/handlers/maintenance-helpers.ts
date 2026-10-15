import { OCCURRENCE_ACTIONS, PLAN_ACTIONS, resolveSlots } from '@/domain/actions';
import type { OccurrenceAction, PlanAction } from '@/domain/actions';
import { OCCURRENCE_FINAL_STATUSES, OCCURRENCE_STATUS_LABEL, PLAN_STATUS_LABEL } from '@/domain/constants';
import type { SubjectType } from '@/domain/constants';
import { forbidden, invalidTransition } from '@/domain/errors';
import { canAccessLocation, denyReason } from '@/domain/permissions';
import { desiredOccurrenceTasks } from '@/domain/task-rules';
import type { MaintenanceItem, MaintenanceOccurrence, MaintenancePlan, TaskCompletionReason } from '@/domain/types';
import { vnEndOfDayIso } from '@/utils/date';
import type { Command } from '../command-engine';
import { assertScopeAndVersion, bumpVersion, syncTasks, writeAudit } from '../command-context';
import type { CommandContext } from '../command-context';

export const loadOccurrenceFor = async (
  ctx: CommandContext,
  command: Command,
  action: OccurrenceAction,
): Promise<MaintenanceOccurrence> => {
  const occurrence = command.subjectId ? await ctx.db.occurrences.get(command.subjectId) : undefined;
  assertScopeAndVersion(ctx, occurrence, command.expectedVersion);
  const current = occurrence as MaintenanceOccurrence;
  const def = OCCURRENCE_ACTIONS[action];
  const reason = denyReason(ctx.actor, current, def.capability, resolveSlots(def.slot, current));
  if (reason) throw forbidden(reason);
  const item = await ctx.db.maintenanceItems.get(current.itemId);
  if (!canAccessLocation(ctx.actor, current.buildingId, item?.locationId)) throw forbidden('Ngoài phạm vi khu vực của bạn.');
  if (!(def.from as readonly string[]).includes(current.status)) {
    throw invalidTransition(`Không thể “${def.label}” khi lượt đang ở trạng thái “${OCCURRENCE_STATUS_LABEL[current.status]}”.`);
  }
  return current;
};

export const loadPlanFor = async (ctx: CommandContext, command: Command, action: PlanAction): Promise<MaintenancePlan> => {
  const plan = command.subjectId ? await ctx.db.maintenancePlans.get(command.subjectId) : undefined;
  assertScopeAndVersion(ctx, plan, command.expectedVersion);
  const current = plan as MaintenancePlan;
  const def = PLAN_ACTIONS[action];
  const reason = denyReason(ctx.actor, current, def.capability, resolveSlots(def.slot, current));
  if (reason) throw forbidden(reason);
  const item = await ctx.db.maintenanceItems.get(current.itemId);
  if (!canAccessLocation(ctx.actor, current.buildingId, item?.locationId)) throw forbidden('Ngoài phạm vi khu vực của bạn.');
  if (!(def.from as readonly string[]).includes(current.status)) {
    throw invalidTransition(`Không thể “${def.label}” khi kế hoạch đang ở trạng thái “${PLAN_STATUS_LABEL[current.status]}”.`);
  }
  return current;
};

/** Work tasks are due at the end of the scheduled day; the review step has no due time. */
export const occurrenceTaskDueAt = (occurrence: MaintenanceOccurrence): string | undefined =>
  occurrence.status === 'PENDING_REVIEW' ? undefined : vnEndOfDayIso(occurrence.scheduledDate);

interface CommitOptions {
  reason?: string;
  closeReason?: TaskCompletionReason;
}

export const commitOccurrence = async (
  ctx: CommandContext,
  before: MaintenanceOccurrence | null,
  after: MaintenanceOccurrence,
  action: string,
  options: CommitOptions = {},
): Promise<MaintenanceOccurrence> => {
  const next = before ? bumpVersion(ctx, after) : after;
  await ctx.db.occurrences.put(next);
  await writeAudit(ctx, {
    subjectType: 'MAINTENANCE_OCCURRENCE',
    subjectId: next.id,
    buildingId: next.buildingId,
    action,
    fromStatus: before?.status,
    toStatus: next.status,
    entityVersion: next.version,
    reason: options.reason,
  });
  const isFinal = OCCURRENCE_FINAL_STATUSES.includes(next.status);
  const item = await ctx.db.maintenanceItems.get(next.itemId);
  await syncTasks(ctx, {
    subjectType: 'MAINTENANCE_OCCURRENCE',
    subjectId: next.id,
    buildingId: next.buildingId,
    desired: desiredOccurrenceTasks(next, ctx.usersById, item?.locationId),
    dueAt: occurrenceTaskDueAt(next),
    closeReason: options.closeReason ?? (isFinal ? 'CLOSED' : undefined),
    subjectLabel: next.code,
  });
  return next;
};

/** Saves a plan or item change with version bump and audit (no tasks attached). */
export const commitSimple = async <T extends MaintenancePlan | MaintenanceItem>(
  ctx: CommandContext,
  subjectType: Extract<SubjectType, 'MAINTENANCE_PLAN' | 'MAINTENANCE_ITEM'>,
  before: T | null,
  after: T,
  action: string,
  reason?: string,
): Promise<T> => {
  const next = before ? bumpVersion(ctx, after) : after;
  if (subjectType === 'MAINTENANCE_PLAN') await ctx.db.maintenancePlans.put(next as MaintenancePlan);
  else await ctx.db.maintenanceItems.put(next as MaintenanceItem);
  // Plans audit their status; items audit their condition so a condition history (old → new) can be rebuilt.
  const stateOf = (entity: T): string => ('status' in entity ? String(entity.status) : entity.condition);
  const status = stateOf(next);
  const beforeStatus = before ? stateOf(before) : undefined;
  await writeAudit(ctx, {
    subjectType,
    subjectId: next.id,
    buildingId: next.buildingId,
    action,
    fromStatus: beforeStatus,
    toStatus: status,
    entityVersion: next.version,
    reason,
  });
  return next;
};
