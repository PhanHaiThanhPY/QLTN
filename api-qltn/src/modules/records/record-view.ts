import type { TaskDueDays, WorkflowApprovalStep } from '../../domain/building-config';
import type { RepairRecord } from './entities/repair-record.entity';
import { currentStepKeyOf } from './record-steps';

export interface RepairRecordView {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  noMaintenanceItem: boolean;
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
  createdBy: record.createdBy,
  version: record.version,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
