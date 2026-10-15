import { APPROVAL_STATUSES, OCCURRENCE_STATUS_LABEL, REPAIR_FINAL_STATUSES, REPAIR_STATUS_GROUP_BY_STATUS, REPAIR_STATUS_LABEL } from '@/domain/constants';
import { approvalStepsFor } from '@/domain/actions';
import type { OccurrenceStatus, RepairStatus } from '@/domain/constants';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { IsoDate, MaintenanceOccurrence, RepairRecord, User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { toVnDate } from '@/utils/date';
import { occurrenceIndicator } from './maintenance-service';
import { now, todayVn } from './runtime';
import { requireViewer, scopedBuildingIds } from './viewer';

export interface ReportFilters {
  buildingId?: string;
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  repairStatus?: RepairStatus;
  maintenanceStatus?: OccurrenceStatus;
}

const inPeriod = (date: IsoDate | undefined, filters: ReportFilters): boolean => {
  if (!date) return false;
  if (filters.dateFrom && date < filters.dateFrom) return false;
  if (filters.dateTo && date > filters.dateTo) return false;
  return true;
};

const requireReportViewer = async (): Promise<User> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'REPORT_VIEW')) throw forbidden('Vai trò của bạn không xem được báo cáo.');
  return viewer;
};

export interface RepairReportRow {
  record: RepairRecord;
  approvedAmount?: number;
  approvedAt?: string;
  paidAmount: number;
  paidDate?: IsoDate;
}

export interface RepairReport {
  byStatus: { status: RepairStatus; label: string; count: number }[];
  createdCount: number;
  openCount: number;
  overdueCount: number;
  attentionCount: number;
  approvedTotal: number;
  approvedCount: number;
  paidTotal: number;
  attentionRows: RepairReportRow[];
  rows: RepairReportRow[];
}

/**
 * Status counts use createdAt; approved value uses the APPROVED decision date of the approved
 * submission (counted once per record); paid value uses Payment.paidDate (spec 11.3).
 */
export const getRepairReport = async (filters: ReportFilters = {}): Promise<RepairReport> => {
  const viewer = await requireReportViewer();
  const db = getDb();
  const records = await db.records.where('buildingId').anyOf(scopedBuildingIds(viewer, filters.buildingId)).toArray();
  const ids = records.map((record) => record.id);
  const [submissions, decisions, payments] = await Promise.all([
    db.submissions.where('recordId').anyOf(ids).toArray(),
    db.approvalDecisions.where('recordId').anyOf(ids).filter((row) => row.outcome === 'APPROVED').toArray(),
    db.payments.where('recordId').anyOf(ids).toArray(),
  ]);
  const submissionById = new Map(submissions.map((row) => [row.id, row]));
  const rows: RepairReportRow[] = records.map((record) => {
    const approved = record.approvedSubmissionId ? submissionById.get(record.approvedSubmissionId) : undefined;
    // The last configured approval step dates the approved value.
    const finalApprovalStep = approvalStepsFor(record.approvalStepKeys).at(-1)?.key;
    const decision = decisions.find((row) => row.submissionId === record.approvedSubmissionId && row.step === finalApprovalStep);
    const recordPayments = payments.filter((row) => row.recordId === record.id).sort((a, b) => a.paidDate.localeCompare(b.paidDate));
    return {
      record,
      approvedAmount: approved?.amountVnd,
      approvedAt: decision?.createdAt,
      paidAmount: recordPayments.reduce((sum, row) => sum + row.amountVnd, 0),
      paidDate: recordPayments[recordPayments.length - 1]?.paidDate,
    };
  });
  const filteredRows = rows.filter((row) => !filters.repairStatus || row.record.status === filters.repairStatus);
  const filteredRecordIds = new Set(filteredRows.map((row) => row.record.id));
  const created = records.filter(
    (record) => inPeriod(toVnDate(record.createdAt), filters) && (!filters.repairStatus || record.status === filters.repairStatus),
  );
  const approvedRows = filteredRows.filter((row) => row.approvedAmount !== undefined && inPeriod(row.approvedAt && toVnDate(row.approvedAt), filters));
  const paidRows = payments.filter((row) => inPeriod(row.paidDate, filters) && (!filters.repairStatus || filteredRecordIds.has(row.recordId)));
  const statuses = Object.keys(REPAIR_STATUS_LABEL) as RepairStatus[];
  const createdSet = new Set(created);
  const approvedSet = new Set(approvedRows);
  const paidRecordIds = new Set(paidRows.map((payment) => payment.recordId));
  const createdRows = filteredRows.filter((row) => createdSet.has(row.record));
  const attentionRows = createdRows.filter(
    (row) =>
      (row.record.dueAt !== undefined && new Date(row.record.dueAt) < now() && !REPAIR_FINAL_STATUSES.includes(row.record.status)) ||
      REPAIR_STATUS_GROUP_BY_STATUS[row.record.status] === 'NEEDS_ACTION',
  );
  const overdueRows = attentionRows.filter(
    (row) => row.record.dueAt !== undefined && new Date(row.record.dueAt) < now() && !REPAIR_FINAL_STATUSES.includes(row.record.status),
  );
  return {
    byStatus: statuses.map((status) => ({
      status,
      label: REPAIR_STATUS_LABEL[status],
      count: created.filter((record) => record.status === status).length,
    })),
    createdCount: created.length,
    openCount: created.filter((record) => !REPAIR_FINAL_STATUSES.includes(record.status)).length,
    overdueCount: overdueRows.length,
    attentionCount: attentionRows.length,
    approvedTotal: approvedRows.reduce((sum, row) => sum + (row.approvedAmount ?? 0), 0),
    approvedCount: approvedRows.length,
    paidTotal: paidRows.reduce((sum, row) => sum + row.amountVnd, 0),
    attentionRows,
    // A row belongs to the period when any indicator counts it, so the export matches every total.
    rows: filteredRows
      .filter(
        (row) =>
          createdSet.has(row.record) ||
          approvedSet.has(row) ||
          paidRecordIds.has(row.record.id),
      )
      .sort((a, b) => a.record.code.localeCompare(b.record.code)),
  };
};

export interface MaintenanceReport {
  dueCount: number;
  completedCount: number;
  lateCompletedCount: number;
  cancelledCount: number;
  openCount: number;
  overdueCount: number;
  /** null when no non-cancelled occurrence exists in the period. */
  completionRate: number | null;
  activePlanCount: number;
  issueCount: number;
  linkedRepairCount: number;
  attentionCount: number;
  attentionRows: MaintenanceOccurrence[];
  byStatus: { status: OccurrenceStatus; label: string; count: number }[];
  rows: MaintenanceOccurrence[];
}

/** Maintenance indicators by scheduledDate period (spec 11.3). */
export const getMaintenanceReport = async (filters: ReportFilters = {}): Promise<MaintenanceReport> => {
  const viewer = await requireReportViewer();
  const db = getDb();
  const buildingIds = scopedBuildingIds(viewer, filters.buildingId);
  const [all, plans] = await Promise.all([
    db.occurrences.where('buildingId').anyOf(buildingIds).toArray(),
    db.maintenancePlans.where('buildingId').anyOf(buildingIds).toArray(),
  ]);
  const rows = all.filter(
    (row) => inPeriod(row.scheduledDate, filters) && (!filters.maintenanceStatus || row.status === filters.maintenanceStatus),
  );
  const submissionIds = rows.map((row) => row.currentSubmissionId).filter((id): id is string => Boolean(id));
  const submissions = await db.maintenanceSubmissions.bulkGet(submissionIds);
  const issueOccurrences = new Set(
    submissions
      .filter((row) => row?.checklistSnapshot?.some((entry) => entry.result === 'ISSUE'))
      .map((row) => row?.occurrenceId),
  );
  const today = todayVn();
  const count = (status: OccurrenceStatus) => rows.filter((row) => row.status === status).length;
  const notCancelled = rows.length - count('CANCELLED');
  const statuses = Object.keys(OCCURRENCE_STATUS_LABEL) as OccurrenceStatus[];
  const attentionRows = rows.filter(
    (row) => occurrenceIndicator(row, today) === 'OVERDUE' || row.status === 'PENDING_REVIEW' || issueOccurrences.has(row.id),
  );
  return {
    dueCount: rows.length,
    completedCount: count('COMPLETED'),
    lateCompletedCount: rows.filter((row) => occurrenceIndicator(row, today) === 'LATE_COMPLETION').length,
    cancelledCount: count('CANCELLED'),
    openCount: rows.filter((row) => !['COMPLETED', 'CANCELLED'].includes(row.status)).length,
    overdueCount: rows.filter((row) => occurrenceIndicator(row, today) === 'OVERDUE').length,
    completionRate: notCancelled === 0 ? null : count('COMPLETED') / notCancelled,
    activePlanCount: plans.filter((plan) => plan.status === 'ACTIVE').length,
    issueCount: issueOccurrences.size,
    linkedRepairCount: new Set(rows.flatMap((row) => row.repairRecordIds ?? [])).size,
    attentionCount: attentionRows.length,
    attentionRows,
    byStatus: statuses.map((status) => ({ status, label: OCCURRENCE_STATUS_LABEL[status], count: count(status) })),
    rows: rows.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
  };
};

export interface DashboardData {
  openRepairCount: number;
  overdueRepairCount: number;
  completedRepairCount: number;
  myOpenTaskCount: number;
  recentRecords: RepairRecord[];
  upcomingMaintenance: MaintenanceOccurrence[];
  overdueMaintenance: MaintenanceOccurrence[];
  pendingReviewCount: number;
  /** Records waiting for a correction before the next operational step. */
  needsInformationCount: number;
  /** Records where the manager still needs to prepare the proposal. */
  pendingProposalCount: number;
  /** Records that reached the unresolved outcome after the submission limit. */
  unresolvedCount: number;
  /** Records waiting at any configured approval step. */
  pendingApprovalCount: number;
  /** Sum of approved submission amounts, each record counted once (all time). */
  approvedTotal: number;
  /** Sum of recorded payments (all time). */
  paidTotal: number;
  /** Unread notifications in the viewer's scoped buildings. */
  unreadNotificationCount: number;
}

/** Dashboard without period limits; still restricted to the viewer's buildings. */
export const getDashboard = async (): Promise<DashboardData> => {
  const viewer = await requireViewer();
  const db = getDb();
  const records = await db.records.where('buildingId').anyOf(viewer.buildingIds).toArray();
  const recordIds = new Set(records.map((record) => record.id));
  const [occurrences, myOpenTaskCount, payments, unreadNotificationCount] = await Promise.all([
    db.occurrences.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    db.tasks
      .where('assigneeId')
      .equals(viewer.id)
      .filter((task) => task.status === 'OPEN' && viewer.buildingIds.includes(task.buildingId))
      .count(),
    db.payments.where('recordId').anyOf([...recordIds]).toArray(),
    db.notifications
      .where('recipientId')
      .equals(viewer.id)
      .filter((notification) => !notification.readAt && viewer.buildingIds.includes(notification.buildingId))
      .count(),
  ]);
  const approved = await db.submissions.bulkGet(records.map((record) => record.approvedSubmissionId ?? ''));
  const at = now();
  const today = todayVn();
  const open = records.filter((record) => !REPAIR_FINAL_STATUSES.includes(record.status));
  return {
    openRepairCount: open.length,
    overdueRepairCount: open.filter((record) => record.dueAt && new Date(record.dueAt) < at).length,
    completedRepairCount: records.filter((record) => record.status === 'COMPLETED').length,
    myOpenTaskCount,
    recentRecords: [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    upcomingMaintenance: occurrences
      .filter((row) => occurrenceIndicator(row, today) === 'UPCOMING')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    overdueMaintenance: occurrences
      .filter((row) => occurrenceIndicator(row, today) === 'OVERDUE')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    pendingReviewCount: occurrences.filter((row) => row.status === 'PENDING_REVIEW').length,
    needsInformationCount: records.filter((record) => ['NEEDS_RECORD_UPDATE', 'NEEDS_SUBMISSION_UPDATE', 'NEEDS_PAYMENT_UPDATE', 'NEEDS_REPAIR'].includes(record.status)).length,
    pendingProposalCount: records.filter((record) => record.status === 'PENDING_PROPOSAL').length,
    unresolvedCount: records.filter((record) => record.status === 'UNRESOLVED').length,
    pendingApprovalCount: records.filter((record) => APPROVAL_STATUSES.includes(record.status)).length,
    approvedTotal: approved.reduce((sum, row) => sum + (row?.amountVnd ?? 0), 0),
    paidTotal: payments.reduce((sum, row) => sum + row.amountVnd, 0),
    unreadNotificationCount,
  };
};
