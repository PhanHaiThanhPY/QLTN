import { LIMITS } from '@/domain/constants';
import { generationWindowEnd, listScheduleSlots, scheduleKey } from '@/domain/schedule';
import type { IsoDate, MaintenanceOccurrence, MaintenancePlan } from '@/domain/types';
import { addDays } from '@/utils/date';
import type { CommandContext } from '../command-context';
import { bumpVersion, nextCode, writeAudit } from '../command-context';
import { newId } from '../runtime';
import { commitOccurrence } from './maintenance-helpers';

export interface GenerationOutcome {
  created: number;
  hasMore: boolean;
}

export const buildOccurrence = async (
  ctx: CommandContext,
  plan: MaintenancePlan,
  scheduledDate: IsoDate,
  kind: MaintenanceOccurrence['occurrenceKind'],
  revision?: number,
): Promise<MaintenanceOccurrence> => ({
  id: newId('occ'),
  code: await nextCode(ctx, 'BT'),
  planId: plan.id,
  itemId: plan.itemId,
  buildingId: plan.buildingId,
  occurrenceKind: kind,
  scheduleRevision: revision,
  scheduledDate,
  originalScheduledDate: kind === 'SCHEDULED' ? scheduledDate : undefined,
  scheduleKey: kind === 'SCHEDULED' ? scheduleKey(plan.id, scheduledDate) : undefined,
  status: 'SCHEDULED',
  managerUserId: plan.managerUserId,
  confirmationUserId: plan.confirmationUserId,
  contractorName: plan.contractorName,
  checklist: plan.checklistTemplate.map((item) => ({
    templateItemId: item.id,
    label: item.label,
    required: item.required,
    result: 'NOT_CHECKED',
    attachmentIds: [],
  })),
  repairRecordIds: [],
  attachmentIds: [],
  version: 1,
  createdAt: ctx.now,
  updatedAt: ctx.now,
});

/**
 * Generates SCHEDULED occurrences for one plan in (generatedThrough, until].
 * The planId + originalScheduledDate key is checked inside the transaction, so repeats never duplicate.
 */
export const generateForPlan = async (
  ctx: CommandContext,
  plan: MaintenancePlan,
  budget: number,
  until: IsoDate = generationWindowEnd(ctx.today),
): Promise<{ plan: MaintenancePlan; outcome: GenerationOutcome }> => {
  const slots = listScheduleSlots(plan.scheduleVersions, plan.generatedThrough, until);
  let created = 0;
  let cursor: IsoDate | undefined = plan.generatedThrough;
  for (const slot of slots) {
    if (created >= budget) {
      return { plan: await saveCursor(ctx, plan, cursor), outcome: { created, hasMore: true } };
    }
    const key = scheduleKey(plan.id, slot.date);
    const exists = await ctx.db.occurrences.where('scheduleKey').equals(key).count();
    if (exists === 0) {
      const occurrence = await buildOccurrence(ctx, plan, slot.date, 'SCHEDULED', slot.revision);
      await commitOccurrence(ctx, null, occurrence, 'generateOccurrences');
      created += 1;
    }
    cursor = slot.date;
  }
  return { plan: await saveCursor(ctx, plan, until), outcome: { created, hasMore: false } };
};

const saveCursor = async (ctx: CommandContext, plan: MaintenancePlan, cursor: IsoDate | undefined): Promise<MaintenancePlan> => {
  // The cursor only moves forward; earlier runs may already have generated beyond it.
  if (!cursor || (plan.generatedThrough && cursor <= plan.generatedThrough)) return plan;
  const next = bumpVersion(ctx, { ...plan, generatedThrough: cursor });
  await ctx.db.maintenancePlans.put(next);
  return next;
};

/** Runs generation for all ACTIVE plans in the given buildings with one shared budget (spec 6.5). */
export const generateForBuildings = async (ctx: CommandContext, buildingIds: string[]): Promise<GenerationOutcome> => {
  const plans = await ctx.db.maintenancePlans
    .where('buildingId')
    .anyOf(buildingIds)
    .filter((plan) => plan.status === 'ACTIVE')
    .sortBy('code');
  let created = 0;
  let hasMore = false;
  for (const plan of plans) {
    const budget = LIMITS.GENERATION_LIMIT - created;
    if (budget <= 0) {
      hasMore = true;
      break;
    }
    const { outcome } = await generateForPlan(ctx, plan, budget);
    created += outcome.created;
    hasMore = hasMore || outcome.hasMore;
  }
  return { created, hasMore };
};

/**
 * Resuming a paused plan: periods never generated before pausedAt are generated late,
 * periods inside the pause are recorded as skipped instead of creating overdue work.
 */
export const resumeAfterPause = async (ctx: CommandContext, plan: MaintenancePlan, pausedDate: IsoDate): Promise<MaintenancePlan> => {
  const { plan: caughtUp } = await generateForPlan(ctx, plan, LIMITS.GENERATION_LIMIT, pausedDate);
  const yesterday = addDays(ctx.today, -1);
  const skipped = listScheduleSlots(caughtUp.scheduleVersions, caughtUp.generatedThrough, yesterday);
  if (skipped.length === 0) return caughtUp;
  const next = bumpVersion(ctx, {
    ...caughtUp,
    generatedThrough: yesterday,
    skippedPeriods: [
      ...caughtUp.skippedPeriods,
      ...skipped.map((slot) => ({ originalScheduledDate: slot.date, reason: 'PAUSED' as const, recordedAt: ctx.now })),
    ],
  });
  await ctx.db.maintenancePlans.put(next);
  await writeAudit(ctx, {
    subjectType: 'MAINTENANCE_PLAN',
    subjectId: next.id,
    buildingId: next.buildingId,
    action: 'skipPausedPeriods',
    fromStatus: next.status,
    toStatus: next.status,
    entityVersion: next.version,
    reason: `Bỏ qua ${skipped.length} kỳ trong thời gian tạm dừng`,
  });
  return next;
};
