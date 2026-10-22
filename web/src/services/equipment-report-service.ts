import { approvalStepsFor } from '@/domain/actions';
import { ALERT_RULES, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { ItemCondition, RepairStatus } from '@/domain/constants';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { recordItemLink } from '@/domain/record-item-link';
import type { AcceptanceResult, IsoDate, IsoDateTime, MaintenanceItem, RepairRecord, User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { addDays, toVnDate } from '@/utils/date';
import type { ReportFilters } from './report-service';
import { todayVn } from './runtime';
import { assertInScope, requireViewer, scopedBuildingIds } from './viewer';

/** Repairs that never happened do not count as a repair of the equipment. */
const NOT_A_REPAIR: readonly RepairStatus[] = ['CLOSED_NO_REPAIR', 'CLOSED_WITHDRAWN'];

export interface EquipmentReportFilters extends ReportFilters {
  type?: string;
}

export interface EquipmentReportItem {
  item: MaintenanceItem;
  /** Repairs reported inside the period (all repairs when no period is set). */
  repairCount: number;
  repairCountTotal: number;
  openRepairCount: number;
  lastRepairAt?: IsoDateTime;
  /** Approved amount (whole VND) of the repairs counted in the period. */
  cost: number;
  costTotal: number;
  /** Repairs in the last 12 months reach the building's repeated-failure threshold. */
  isRepeated: boolean;
}

export interface EquipmentBuildingSummary {
  buildingId: string;
  itemCount: number;
  byCondition: Record<ItemCondition, number>;
  repairCount: number;
  cost: number;
  repeatedCount: number;
}

export interface EquipmentReport {
  itemCount: number;
  itemsWithRepairs: number;
  repairCount: number;
  cost: number;
  repeatedCount: number;
  /** Records in scope that name neither an item nor "no specific item" (data to complete). */
  unlinkedRecordCount: number;
  types: string[];
  buildings: EquipmentBuildingSummary[];
  items: EquipmentReportItem[];
}

const inPeriod = (date: IsoDate, filters: ReportFilters): boolean =>
  (!filters.dateFrom || date >= filters.dateFrom) && (!filters.dateTo || date <= filters.dateTo);

const requireReportViewer = async (): Promise<User> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'REPORT_VIEW')) throw forbidden('Vai trò của bạn không xem được báo cáo.');
  return viewer;
};

const groupBy = <T>(rows: T[], key: (row: T) => string | undefined): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    if (value) map.set(value, [...(map.get(value) ?? []), row]);
  }
  return map;
};

/**
 * Equipment report: how many items each building has, how often each one was repaired and what it cost.
 * Repairs are dated by when they were reported (same rule as the repair report's status counts).
 */
export const getEquipmentReport = async (filters: EquipmentReportFilters = {}): Promise<EquipmentReport> => {
  const viewer = await requireReportViewer();
  const db = getDb();
  const buildingIds = scopedBuildingIds(viewer, filters.buildingId);
  const [allItems, records, configs] = await Promise.all([
    db.maintenanceItems.where('buildingId').anyOf(buildingIds).toArray(),
    db.records.where('buildingId').anyOf(buildingIds).toArray(),
    db.buildingConfigs.bulkGet(buildingIds),
  ]);
  const approvedIds = records.flatMap((row) => (row.approvedSubmissionId ? [row.approvedSubmissionId] : []));
  const approved = await db.submissions.bulkGet(approvedIds);
  const costByRecord = new Map(approved.flatMap((row) => (row ? [[row.recordId, row.amountVnd] as const] : [])));
  const repeatMin = new Map(configs.flatMap((row) => (row ? [[row.buildingId, row.repeatMinRecords] as const] : [])));
  const windowStart = addDays(todayVn(), -ALERT_RULES.REPEAT_WINDOW_DAYS);

  const repairs = records.filter((row) => !NOT_A_REPAIR.includes(row.status));
  const itemBuilding = new Map(allItems.map((item) => [item.id, item.buildingId]));
  // A record only counts for an item of its own building (same rule as the item detail page).
  const repairsByItem = groupBy(repairs, (row) => (row.maintenanceItemId && itemBuilding.get(row.maintenanceItemId) === row.buildingId ? row.maintenanceItemId : undefined));
  const types = [...new Set(allItems.map((row) => row.type))].sort((a, b) => a.localeCompare(b, 'vi'));
  const items = allItems.filter((row) => !filters.type || row.type === filters.type);

  const rows: EquipmentReportItem[] = items
    .map((item) => {
      const own = repairsByItem.get(item.id) ?? [];
      const inRange = own.filter((row) => inPeriod(toVnDate(row.createdAt), filters));
      const recent = own.filter((row) => toVnDate(row.createdAt) >= windowStart);
      const sumCost = (list: RepairRecord[]) => list.reduce((sum, row) => sum + (costByRecord.get(row.id) ?? 0), 0);
      return {
        item,
        repairCount: inRange.length,
        repairCountTotal: own.length,
        openRepairCount: own.filter((row) => !REPAIR_FINAL_STATUSES.includes(row.status)).length,
        lastRepairAt: own.map((row) => row.createdAt).sort().at(-1),
        cost: sumCost(inRange),
        costTotal: sumCost(own),
        // Same threshold as the "Hỏng lặp lại" alert: more than repeatMinRecords repairs in 12 months.
        isRepeated: recent.length > (repeatMin.get(item.buildingId) ?? ALERT_RULES.REPEAT_MIN_RECORDS),
      };
    })
    .filter((row) => row.item.active || row.repairCountTotal > 0)
    .sort((a, b) => b.repairCount - a.repairCount || b.cost - a.cost || a.item.code.localeCompare(b.item.code));

  const buildings = buildingIds
    .map((buildingId) => {
      const own = rows.filter((row) => row.item.buildingId === buildingId);
      const byCondition: Record<ItemCondition, number> = { GOOD: 0, NEEDS_ATTENTION: 0, UNKNOWN: 0 };
      for (const row of own) byCondition[row.item.condition] += 1;
      return {
        buildingId,
        itemCount: own.length,
        byCondition,
        repairCount: own.reduce((sum, row) => sum + row.repairCount, 0),
        cost: own.reduce((sum, row) => sum + row.cost, 0),
        repeatedCount: own.filter((row) => row.isRepeated).length,
      };
    })
    .filter((row) => row.itemCount > 0 || !filters.type);

  const unlinked = records.filter(
    (row) => recordItemLink(row) === 'UNLINKED' && row.status !== 'CLOSED_WITHDRAWN' && inPeriod(toVnDate(row.createdAt), filters),
  );
  return {
    itemCount: rows.length,
    itemsWithRepairs: rows.filter((row) => row.repairCount > 0).length,
    repairCount: rows.reduce((sum, row) => sum + row.repairCount, 0),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
    repeatedCount: rows.filter((row) => row.isRepeated).length,
    unlinkedRecordCount: unlinked.length,
    types,
    buildings,
    items: rows,
  };
};

export interface AcceptanceRoundSummary {
  roundNo: number;
  result: AcceptanceResult;
  submittedAt: IsoDateTime;
  /** Notes of the reviewers who failed the round. */
  failNotes: string[];
}

/** One repair of an item with what was done, by whom, for how much and when. */
export interface EquipmentRepairEntry {
  record: RepairRecord;
  proposal?: string;
  contractorName?: string;
  approvedAmount?: number;
  approvedAt?: IsoDateTime;
  constructionStart?: IsoDate;
  constructionEnd?: IsoDate;
  constructionNotes: string[];
  acceptanceRounds: AcceptanceRoundSummary[];
  paidAmount: number;
  /** Days from report to completion; only for completed repairs. */
  durationDays?: number;
}

/** Maintenance visit that found problems on the item (shown alongside repairs on request). */
export interface EquipmentIssueEntry {
  occurrenceId: string;
  code: string;
  date: IsoDate;
  issues: { label: string; note?: string }[];
}

export interface EquipmentHistory {
  item: MaintenanceItem;
  repairs: EquipmentRepairEntry[];
  issues: EquipmentIssueEntry[];
  repairCount: number;
  costTotal: number;
}

const daysBetween = (from: IsoDateTime, to: IsoDateTime): number =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));

/** Full repair history of one item (newest first); visible to anyone who can see the item. */
export const getEquipmentHistory = async (itemId: string): Promise<EquipmentHistory> => {
  const viewer = await requireViewer();
  const db = getDb();
  const item = assertInScope(viewer, await db.maintenanceItems.get(itemId));
  const records = (await db.records.where('maintenanceItemId').equals(itemId).toArray())
    .filter((row) => row.buildingId === item.buildingId && !NOT_A_REPAIR.includes(row.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ids = records.map((row) => row.id);
  const [submissions, decisions, constructions, acceptances, payments, occurrences] = await Promise.all([
    db.submissions.where('recordId').anyOf(ids).toArray(),
    db.approvalDecisions.where('recordId').anyOf(ids).filter((row) => row.outcome === 'APPROVED').toArray(),
    db.constructions.where('recordId').anyOf(ids).toArray(),
    db.acceptances.where('recordId').anyOf(ids).toArray(),
    db.payments.where('recordId').anyOf(ids).toArray(),
    db.occurrences.where('itemId').equals(itemId).toArray(),
  ]);
  const repairs = records.map((record): EquipmentRepairEntry => {
    const own = submissions.filter((row) => row.recordId === record.id).sort((a, b) => b.attemptNo - a.attemptNo);
    const shown = own.find((row) => row.id === record.approvedSubmissionId) ?? own[0];
    const finalStep = approvalStepsFor(record.approvalStepKeys, record.workflowApprovalSteps).at(-1)?.key;
    const decision = decisions.find((row) => row.submissionId === record.approvedSubmissionId && row.step === finalStep);
    const construction = constructions.find((row) => row.recordId === record.id);
    const rounds = acceptances
      .filter((row) => row.recordId === record.id)
      .sort((a, b) => a.roundNo - b.roundNo)
      .map((row) => ({
        roundNo: row.roundNo,
        result: row.result,
        submittedAt: row.submittedAt,
        failNotes: row.checks.filter((check) => !check.passed && check.note).map((check) => check.note),
      }));
    const isDone = record.status === 'COMPLETED' && record.closedAt;
    return {
      record,
      proposal: shown?.proposal,
      contractorName: shown?.contractorName || record.emergency?.contractorName,
      approvedAmount: record.approvedSubmissionId ? shown?.amountVnd : undefined,
      approvedAt: decision?.createdAt,
      constructionStart: construction?.startDate,
      constructionEnd: construction?.completedDate,
      constructionNotes: (construction?.logs ?? []).map((log) => log.note).filter(Boolean),
      acceptanceRounds: rounds,
      paidAmount: payments.filter((row) => row.recordId === record.id).reduce((sum, row) => sum + row.amountVnd, 0),
      durationDays: isDone && record.closedAt ? daysBetween(record.createdAt, record.closedAt) : undefined,
    };
  });
  const issues = occurrences
    .filter((row) => row.status === 'COMPLETED' && row.checklist.some((entry) => entry.result === 'ISSUE'))
    .map((row) => ({
      occurrenceId: row.id,
      code: row.code,
      date: row.completedAt ? toVnDate(row.completedAt) : row.scheduledDate,
      issues: row.checklist.filter((entry) => entry.result === 'ISSUE').map((entry) => ({ label: entry.label, note: entry.note })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    item,
    repairs,
    issues,
    repairCount: repairs.length,
    costTotal: repairs.reduce((sum, row) => sum + (row.approvedAmount ?? 0), 0),
  };
};
