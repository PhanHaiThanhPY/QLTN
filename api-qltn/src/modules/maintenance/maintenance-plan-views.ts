import type { ChecklistTemplateItem, MaintenancePlan, PlanStatus } from './entities/maintenance-plan.entity';
import type { MaintenanceOccurrence } from './entities/maintenance-occurrence.entity';
import type { MaintenanceScheduleVersion } from './entities/maintenance-schedule-version.entity';
import { scheduleLabel, versionOn, liveVersions } from '../../domain/maintenance-schedule';

export interface ScheduleVersionView {
  id: string;
  unit: 'WEEK' | 'MONTH';
  every: number;
  label: string;
  effectiveFrom: string;
  anchorDate: string;
  reason: string | null;
  supersededBy: string | null;
  supersededAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface MaintenancePlanView {
  id: string;
  code: string;
  itemId: string;
  buildingId: string;
  name: string;
  status: PlanStatus;
  managerUserId: string;
  performerUserId: string;
  reviewerUserId: string;
  contractorName: string | null;
  checklist: ChecklistTemplateItem[];
  activeSince: string | null;
  pausedOn: string | null;
  statusReason: string | null;
  /** The schedule in force today (or the first one of a plan that has not started). */
  schedule: ScheduleVersionView | null;
  /** BR-MT2-02: the performer or reviewer can no longer act ("Cần giao lại"). */
  needsReassignment: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OccurrenceView {
  id: string;
  code: string;
  planId: string;
  itemId: string;
  buildingId: string;
  scheduledDate: string;
  periodDate: string | null;
  status: string;
  isMakeup: boolean;
  scheduleChanged: boolean;
  cancelReason: string | null;
  performerUserId: string;
  reviewerUserId: string;
  contractorName: string | null;
  checklist: ChecklistTemplateItem[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toVersionView = (row: MaintenanceScheduleVersion): ScheduleVersionView => ({
  id: row.id,
  unit: row.unit,
  every: row.every,
  label: scheduleLabel(row),
  effectiveFrom: row.effectiveFrom,
  anchorDate: row.anchorDate,
  reason: row.reason,
  supersededBy: row.supersededBy,
  supersededAt: row.supersededAt,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

/** Schedule of the plan on `today`, else its earliest live one (a draft or a plan starting later). */
export const currentSchedule = (
  versions: readonly MaintenanceScheduleVersion[],
  today: string,
): MaintenanceScheduleVersion | undefined => versionOn(versions, today) ?? liveVersions(versions)[0];

export const toPlanView = (
  plan: MaintenancePlan,
  versions: readonly MaintenanceScheduleVersion[],
  today: string,
  needsReassignment: boolean,
): MaintenancePlanView => {
  const schedule = currentSchedule(versions, today);
  return {
    id: plan.id,
    code: plan.code,
    itemId: plan.itemId,
    buildingId: plan.buildingId,
    name: plan.name,
    status: plan.status,
    managerUserId: plan.managerUserId,
    performerUserId: plan.performerUserId,
    reviewerUserId: plan.reviewerUserId,
    contractorName: plan.contractorName,
    checklist: plan.checklist,
    activeSince: plan.activeSince,
    pausedOn: plan.pausedOn,
    statusReason: plan.statusReason,
    schedule: schedule ? toVersionView(schedule) : null,
    needsReassignment,
    version: plan.version,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
};

export const toOccurrenceView = (row: MaintenanceOccurrence): OccurrenceView => ({
  id: row.id,
  code: row.code,
  planId: row.planId,
  itemId: row.itemId,
  buildingId: row.buildingId,
  scheduledDate: row.scheduledDate,
  periodDate: row.periodDate,
  status: row.status,
  isMakeup: row.isMakeup,
  scheduleChanged: row.scheduleChanged,
  cancelReason: row.cancelReason,
  performerUserId: row.performerUserId,
  reviewerUserId: row.reviewerUserId,
  contractorName: row.contractorName,
  checklist: row.checklist,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
