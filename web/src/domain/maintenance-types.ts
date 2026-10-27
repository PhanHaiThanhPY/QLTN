import type { CheckResult, Frequency, ItemCondition, OccurrenceStatus, PlanStatus } from './constants';
import type { IsoDate, IsoDateTime, Versioned } from './types';

export interface MaintenanceItem extends Versioned {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  name: string;
  type: string;
  description?: string;
  ownerUserId: string;
  model?: string;
  supplier?: string;
  installDate?: IsoDate;
  warrantyUntil?: IsoDate;
  /** ITEM_DOCUMENT attachments (manuals, warranty, contracts). */
  documentIds: string[];
  condition: ItemCondition;
  conditionNote?: string;
  active: boolean;
  /** api mode (MT-S1): when and why the item was taken out of use. */
  deactivatedAt?: string;
  deactivationReason?: string;
}
export interface ScheduleVersion {
  revision: number;
  effectiveFrom: IsoDate;
  anchorDate: IsoDate;
  frequency: Frequency;
  intervalMonths: number;
}

export type ChecklistInputType = 'CHECK' | 'MEASUREMENT';

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
  inputType?: ChecklistInputType;
  unit?: string;
  minValue?: number;
  maxValue?: number;
}

export interface SkippedPeriod {
  originalScheduledDate: IsoDate;
  reason: 'PAUSED';
  recordedAt: IsoDateTime;
}

export interface MaintenancePlan extends Versioned {
  id: string;
  code: string;
  itemId: string;
  buildingId: string;
  title: string;
  status: PlanStatus;
  scheduleVersions: ScheduleVersion[];
  generatedThrough?: IsoDate;
  pausedAt?: IsoDateTime;
  skippedPeriods: SkippedPeriod[];
  checklistTemplate: ChecklistTemplateItem[];
  managerUserId: string;
  confirmationUserId: string;
  /** Free-text contractor name (no contractor catalogue). */
  contractorName?: string;
}

export interface MaintenanceChecklistEntry {
  templateItemId: string;
  label: string;
  required: boolean;
  inputType?: ChecklistInputType;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  result: CheckResult;
  measurementValue?: number;
  note?: string;
  attachmentIds: string[];
}

export type OccurrenceKind = 'SCHEDULED' | 'MANUAL';

export interface MaintenanceOccurrence extends Versioned {
  id: string;
  code: string;
  planId: string;
  itemId: string;
  buildingId: string;
  occurrenceKind: OccurrenceKind;
  scheduleRevision?: number;
  scheduledDate: IsoDate;
  originalScheduledDate?: IsoDate;
  /** planId|originalScheduledDate for SCHEDULED kind; unique index guards duplicates. */
  scheduleKey?: string;
  status: OccurrenceStatus;
  managerUserId: string;
  confirmationUserId: string;
  performerName?: string;
  /** Free-text contractor name (no contractor catalogue). */
  contractorName?: string;
  checklist: MaintenanceChecklistEntry[];
  resultNote?: string;
  currentSubmissionId?: string;
  /** Deadline snapshot for the current review round. */
  reviewDueAt?: IsoDateTime;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  cancelReason?: string;
  reviewFlag?: 'SCHEDULE_CHANGED';
  repairRecordIds: string[];
  attachmentIds: string[];
}

export interface MaintenanceSubmission {
  id: string;
  occurrenceId: string;
  roundNo: number;
  checklistSnapshot: MaintenanceChecklistEntry[];
  resultNote: string;
  performerName: string;
  /** Free-text contractor name (no contractor catalogue). */
  contractorName?: string;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: IsoDateTime;
}

export type MaintenanceReviewOutcome = 'REWORK' | 'CONFIRMED';
export type MaintenanceItemReviewOutcome = 'APPROVED' | 'REWORK';

/** Reviewer decision for one immutable checklist item in a submitted round. */
export interface MaintenanceItemReview {
  templateItemId: string;
  outcome: MaintenanceItemReviewOutcome;
  reason?: string;
}

export interface MaintenanceReview {
  id: string;
  occurrenceId: string;
  submissionId: string;
  roundNo: number;
  actorId: string;
  outcome: MaintenanceReviewOutcome;
  reason?: string;
  itemReviews?: MaintenanceItemReview[];
  itemConditionAfter?: ItemCondition;
  createdAt: IsoDateTime;
}
