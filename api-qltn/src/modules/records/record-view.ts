import type { TaskDueDays, WorkflowApprovalStep } from '../../domain/building-config';
import {
  emergencyTiming,
  isOverEmergencyLimit,
  type EmergencyInfo,
  type EmergencyTiming,
} from '../../domain/emergency';
import type { RepairRecord } from './entities/repair-record.entity';
import { currentStepKeyOf } from './record-steps';

/** B06-S1 BR-E-11: the stored emergency data plus what the server derives from it. */
export type EmergencyView = EmergencyInfo & EmergencyTiming & { overEmergencyLimit: boolean };

const toEmergencyView = (record: RepairRecord): EmergencyView | null =>
  record.emergency
    ? {
        ...record.emergency,
        ...emergencyTiming(record.emergency, new Date()),
        overEmergencyLimit: isOverEmergencyLimit(record.emergency, record.approvedAmountVnd),
      }
    : null;

export interface RepairRecordView {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  noMaintenanceItem: boolean;
  /** MT-S1: the equipment of the record, or null. */
  maintenanceItemId: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  managerUserId: string;
  confirmationUserId: string;
  consultantUserId: string;
  boardUserId: string;
  approvalStepKeys: string[];
  workflowApprovalSteps: WorkflowApprovalStep[];
  workflowStageApprovalStepKeys: Partial<Record<string, string[]>>;
  approvalAssigneeUserIds: Record<string, string>;
  /** Snapshot of the building's task due days when the record was created. */
  dueDays: TaskDueDays;
  /** Ordered ids of the site photos attached to the record. */
  attachmentIds: string[];
  /** Approval step the proposal waits on (S2), else null. */
  currentApprovalStepKey: string | null;
  currentSubmissionId: string | null;
  approvedSubmissionId: string | null;
  /** Integer VND as a string; set when the last approval step approves. */
  approvedAmountVnd: string | null;
  executingContractorName: string | null;
  /** Emergency repair (B06-S1), null for a regular record. */
  emergency: EmergencyView | null;
  /** TK-S1 BR-TK-04: deadline of the current step and whether it passed; set by `GET /records` and `GET /records/:id`. */
  dueAt?: Date | null;
  isOverdue?: boolean;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toRecordView = (record: RepairRecord): RepairRecordView => ({
  id: record.id,
  code: record.code,
  buildingId: record.buildingId,
  locationId: record.locationId ?? '',
  noMaintenanceItem: record.noMaintenanceItem,
  maintenanceItemId: record.maintenanceItemId,
  title: record.title,
  description: record.description,
  priority: record.priority,
  status: record.status,
  managerUserId: record.managerUserId,
  confirmationUserId: record.confirmationUserId ?? '',
  consultantUserId: record.consultantUserId ?? '',
  boardUserId: record.boardUserId ?? '',
  approvalStepKeys: [...record.approvalStepKeys],
  workflowApprovalSteps: record.workflowApprovalSteps.map((step) => ({ ...step })),
  workflowStageApprovalStepKeys: record.workflowStageApprovalStepKeys,
  approvalAssigneeUserIds: { ...record.approvalAssigneeUserIds },
  dueDays: { ...record.taskDueDays },
  attachmentIds: [...record.attachmentIds],
  currentApprovalStepKey: currentStepKeyOf(record),
  currentSubmissionId: record.currentSubmissionId,
  approvedSubmissionId: record.approvedSubmissionId,
  approvedAmountVnd: record.approvedAmountVnd,
  executingContractorName: record.executingContractorName,
  emergency: toEmergencyView(record),
  createdBy: record.createdBy,
  version: record.version,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
