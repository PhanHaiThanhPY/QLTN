import { LIMITS, OCCURRENCE_FINAL_STATUSES, OCCURRENCE_OVERDUE_STATUSES, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import type { OccurrenceStatus, PlanStatus } from '@/domain/constants';
import { nextScheduleDate } from '@/domain/schedule';
import { unassignableSlots } from '@/domain/task-rules';
import type { AssigneeSlot } from '@/domain/permissions';
import type {
  Attachment,
  AuditEvent,
  IsoDate,
  MaintenanceItem,
  MaintenanceOccurrence,
  MaintenancePlan,
  MaintenanceReview,
  MaintenanceSubmission,
  RepairRecord,
} from '@/domain/types';
import { getDb } from '@/storage/db';
import { addDays, toVnDate } from '@/utils/date';
import type { Page } from './records-service';
import { todayVn } from './runtime';
import { assertInScope, requireViewer, scopedBuildingIds } from './viewer';

export type OccurrenceIndicator = 'OVERDUE' | 'UPCOMING' | 'LATE_COMPLETION' | null;

/** Indicators from spec 6.2; they are not statuses. */
export const occurrenceIndicator = (occurrence: MaintenanceOccurrence, today: IsoDate = todayVn()): OccurrenceIndicator => {
  if (OCCURRENCE_OVERDUE_STATUSES.includes(occurrence.status) && occurrence.scheduledDate < today) return 'OVERDUE';
  const upcomingEnd = addDays(today, LIMITS.UPCOMING_DAYS);
  if (occurrence.status === 'SCHEDULED' && occurrence.scheduledDate >= today && occurrence.scheduledDate <= upcomingEnd) {
    return 'UPCOMING';
  }
  if (occurrence.status === 'COMPLETED' && occurrence.completedAt && toVnDate(occurrence.completedAt) > occurrence.scheduledDate) {
    return 'LATE_COMPLETION';
  }
  return null;
};

export interface ItemFilters {
  q?: string;
  buildingId?: string;
  type?: string;
  includeInactive?: boolean;
}

/** One equipment row of the list with its maintenance and repair situation. */
export interface ItemListRow {
  item: MaintenanceItem;
  /** Earliest open occurrence (overdue ones come first because they are the oldest). */
  nextOccurrence?: Pick<MaintenanceOccurrence, 'id' | 'code' | 'scheduledDate' | 'status'>;
  overdueCount: number;
  /** VN date of the latest completed occurrence. */
  lastCompletedDate?: IsoDate;
  openRepairCount: number;
  repairCount: number;
}

const matchesQuery = (item: MaintenanceItem, q: string, locationText: string): boolean =>
  [item.code, item.name, item.type, item.model ?? '', item.supplier ?? '', locationText].some((value) => value.toLowerCase().includes(q));

/** Equipment list with next/overdue maintenance and open repairs per item (two indexed reads, no per-row query). */
export const listItemOverview = async (filters: ItemFilters = {}): Promise<ItemListRow[]> => {
  const viewer = await requireViewer();
  const db = getDb();
  const today = todayVn();
  const q = filters.q?.trim().toLowerCase();
  const scoped = await db.maintenanceItems.where('buildingId').anyOf(scopedBuildingIds(viewer, filters.buildingId)).toArray();
  const locations = new Map((await db.locations.where('buildingId').anyOf([...new Set(scoped.map((row) => row.buildingId))]).toArray()).map((row) => [row.id, row]));
  const items = scoped
    .filter((row) => filters.includeInactive || row.active)
    .filter((row) => !filters.type || row.type === filters.type)
    .filter((row) => {
      if (!q) return true;
      const location = locations.get(row.locationId);
      return matchesQuery(row, q, location ? `${location.name} ${location.floor ?? ''}` : '');
    });
  const ids = items.map((row) => row.id);
  const [occurrences, records] = await Promise.all([
    db.occurrences.where('itemId').anyOf(ids).toArray(),
    db.records.where('maintenanceItemId').anyOf(ids).toArray(),
  ]);
  const occurrencesByItem = new Map<string, MaintenanceOccurrence[]>();
  for (const row of occurrences) occurrencesByItem.set(row.itemId, [...(occurrencesByItem.get(row.itemId) ?? []), row]);
  const recordsByItem = new Map<string, RepairRecord[]>();
  for (const row of records) {
    if (row.maintenanceItemId) recordsByItem.set(row.maintenanceItemId, [...(recordsByItem.get(row.maintenanceItemId) ?? []), row]);
  }
  return items
    .map((item) => {
      const own = occurrencesByItem.get(item.id) ?? [];
      const open = own
        .filter((row) => !OCCURRENCE_FINAL_STATUSES.includes(row.status))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const completed = own
        .filter((row) => row.status === 'COMPLETED')
        .map((row) => (row.completedAt ? toVnDate(row.completedAt) : row.scheduledDate))
        .sort();
      const repairs = (recordsByItem.get(item.id) ?? []).filter((row) => row.buildingId === item.buildingId);
      const next = open[0];
      return {
        item,
        nextOccurrence: next ? { id: next.id, code: next.code, scheduledDate: next.scheduledDate, status: next.status } : undefined,
        overdueCount: open.filter((row) => occurrenceIndicator(row, today) === 'OVERDUE').length,
        lastCompletedDate: completed.at(-1),
        openRepairCount: repairs.filter((row) => !REPAIR_FINAL_STATUSES.includes(row.status)).length,
        repairCount: repairs.length,
      };
    })
    .sort((a, b) => a.item.code.localeCompare(b.item.code));
};

export interface ItemDetail {
  item: MaintenanceItem;
  plans: MaintenancePlan[];
  occurrences: MaintenanceOccurrence[];
  /** Same occurrences as list rows (indicators, reassignment, review waiting time). */
  rows: OccurrenceListItem[];
  repairs: RepairRecord[];
  /** Approved proposal amount (whole VND) per repair record id; absent until the proposal is approved. */
  repairCosts: Record<string, number>;
  /** ITEM_DOCUMENT files listed on the item, in its order. */
  documents: Attachment[];
  audit: AuditEvent[];
}

/** Item history: every occurrence of the item plus every repair record linked to it in the same building. */
export const getItemDetail = async (itemId: string): Promise<ItemDetail> => {
  const viewer = await requireViewer();
  const db = getDb();
  const item = assertInScope(viewer, await db.maintenanceItems.get(itemId));
  const [plans, occurrences, repairs, audit] = await Promise.all([
    db.maintenancePlans.where('itemId').equals(itemId).sortBy('code'),
    db.occurrences.where('itemId').equals(itemId).toArray(),
    db.records.where('maintenanceItemId').equals(itemId).filter((row) => row.buildingId === item.buildingId).toArray(),
    db.auditEvents.where('[subjectType+subjectId]').equals(['MAINTENANCE_ITEM', itemId]).sortBy('createdAt'),
  ]);
  const sortedOccurrences = occurrences.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const documents = (await db.attachments.bulkGet(item.documentIds ?? [])).filter((row): row is Attachment => Boolean(row));
  const approvedIds = repairs.flatMap((row) => (row.approvedSubmissionId ? [row.approvedSubmissionId] : []));
  const approved = await db.submissions.bulkGet(approvedIds);
  const repairCosts = Object.fromEntries(approved.flatMap((row) => (row ? [[row.recordId, row.amountVnd] as const] : [])));
  return {
    item,
    plans,
    occurrences: sortedOccurrences,
    rows: await toListItems(sortedOccurrences, todayVn()),
    repairs: repairs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    repairCosts,
    documents,
    audit: audit.reverse(),
  };
};

export interface PlanFilters {
  buildingId?: string;
  locationId?: string;
  status?: PlanStatus | '';
  itemId?: string;
}

export interface PlanListItem {
  plan: MaintenancePlan;
  nextDueDate?: IsoDate;
}

export const listPlans = async (filters: PlanFilters = {}): Promise<PlanListItem[]> => {
  const viewer = await requireViewer();
  const today = todayVn();
  const db = getDb();
  const scopedIds = scopedBuildingIds(viewer, filters.buildingId);
  const [rows, items] = await Promise.all([
    db.maintenancePlans.where('buildingId').anyOf(scopedIds).toArray(),
    db.maintenanceItems.where('buildingId').anyOf(scopedIds).toArray(),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return rows
    .filter((plan) => !filters.status || plan.status === filters.status)
    .filter((plan) => !filters.itemId || plan.itemId === filters.itemId)
    .filter((plan) => !filters.locationId || itemById.get(plan.itemId)?.locationId === filters.locationId)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((plan) => ({ plan, nextDueDate: plan.status === 'ACTIVE' ? nextScheduleDate(plan, today) : undefined }));
};

export interface PlanDetail {
  plan: MaintenancePlan;
  item?: MaintenanceItem;
  nextDueDate?: IsoDate;
  occurrences: MaintenanceOccurrence[];
  rows: OccurrenceListItem[];
  audit: AuditEvent[];
}

export const getPlanDetail = async (planId: string): Promise<PlanDetail> => {
  const viewer = await requireViewer();
  const db = getDb();
  const plan = assertInScope(viewer, await db.maintenancePlans.get(planId));
  const [item, occurrences, audit] = await Promise.all([
    db.maintenanceItems.get(plan.itemId),
    db.occurrences.where('planId').equals(planId).toArray(),
    db.auditEvents.where('[subjectType+subjectId]').equals(['MAINTENANCE_PLAN', planId]).sortBy('createdAt'),
  ]);
  const sortedOccurrences = occurrences.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return {
    plan,
    item,
    nextDueDate: plan.status === 'ACTIVE' ? nextScheduleDate(plan, todayVn()) : undefined,
    occurrences: sortedOccurrences,
    rows: await toListItems(sortedOccurrences, todayVn()),
    audit: audit.reverse(),
  };
};

export interface OccurrenceFilters {
  buildingId?: string;
  locationId?: string;
  itemId?: string;
  assigneeId?: string;
  status?: OccurrenceStatus | '';
  indicator?: 'OVERDUE' | 'UPCOMING' | '';
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  page?: number;
  pageSize?: number;
}

export interface OccurrenceListItem {
  occurrence: MaintenanceOccurrence;
  indicator: OccurrenceIndicator;
  needsReassignment: boolean;
  /** Submission time of the current round while waiting for review. */
  pendingSince?: string;
}

/** Builds list rows with indicator, reassignment flag and review waiting time. */
const toListItems = async (occurrences: MaintenanceOccurrence[], today: IsoDate): Promise<OccurrenceListItem[]> => {
  const db = getDb();
  const pendingIds = occurrences
    .filter((row) => row.status === 'PENDING_REVIEW' && row.currentSubmissionId)
    .map((row) => row.currentSubmissionId as string);
  const itemIds = [...new Set(occurrences.map((row) => row.itemId))];
  const [users, submissions, items] = await Promise.all([db.users.toArray(), db.maintenanceSubmissions.bulkGet(pendingIds), db.maintenanceItems.bulkGet(itemIds)]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const locationByItem = new Map(items.filter(Boolean).map((row) => [row?.id, row?.locationId]));
  const submittedAt = new Map(submissions.filter(Boolean).map((row) => [row?.id, row?.submittedAt]));
  return occurrences.map((occurrence) => ({
    occurrence,
    indicator: occurrenceIndicator(occurrence, today),
    needsReassignment:
      !['COMPLETED', 'CANCELLED'].includes(occurrence.status) &&
      unassignableSlots({ ...occurrence, locationId: locationByItem.get(occurrence.itemId) }, usersById).length > 0,
    pendingSince: occurrence.status === 'PENDING_REVIEW' ? submittedAt.get(occurrence.currentSubmissionId) : undefined,
  }));
};

export const listOccurrences = async (filters: OccurrenceFilters = {}): Promise<Page<OccurrenceListItem>> => {
  const viewer = await requireViewer();
  const db = getDb();
  const today = todayVn();
  const scopedIds = scopedBuildingIds(viewer, filters.buildingId);
  const [rows, items] = await Promise.all([
    db.occurrences.where('buildingId').anyOf(scopedIds).toArray(),
    db.maintenanceItems.where('buildingId').anyOf(scopedIds).toArray(),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const filtered = rows
    .filter((row) => !filters.locationId || itemById.get(row.itemId)?.locationId === filters.locationId)
    .filter((row) => !filters.itemId || row.itemId === filters.itemId)
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.assigneeId || row.managerUserId === filters.assigneeId || row.confirmationUserId === filters.assigneeId)
    .filter((row) => !filters.dateFrom || row.scheduledDate >= filters.dateFrom)
    .filter((row) => !filters.dateTo || row.scheduledDate <= filters.dateTo);
  const matched = (await toListItems(filtered, today))
    .filter((row) => !filters.indicator || row.indicator === filters.indicator)
    .sort((a, b) => a.occurrence.scheduledDate.localeCompare(b.occurrence.scheduledDate));
  const pageSize = filters.pageSize ?? LIMITS.PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  return { items: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length, page, pageSize };
};

export interface OccurrenceDetail {
  occurrence: MaintenanceOccurrence;
  plan?: MaintenancePlan;
  item?: MaintenanceItem;
  submissions: MaintenanceSubmission[];
  reviews: MaintenanceReview[];
  attachments: Attachment[];
  repairs: RepairRecord[];
  audit: AuditEvent[];
  indicator: OccurrenceIndicator;
  inactiveSlots: AssigneeSlot[];
}

export const getOccurrenceDetail = async (occurrenceId: string): Promise<OccurrenceDetail> => {
  const viewer = await requireViewer();
  const db = getDb();
  const occurrence = assertInScope(viewer, await db.occurrences.get(occurrenceId));
  const [plan, item, submissions, reviews, attachments, repairs, audit, users] = await Promise.all([
    db.maintenancePlans.get(occurrence.planId),
    db.maintenanceItems.get(occurrence.itemId),
    db.maintenanceSubmissions.where('occurrenceId').equals(occurrenceId).sortBy('roundNo'),
    db.maintenanceReviews.where('occurrenceId').equals(occurrenceId).sortBy('createdAt'),
    db.attachments.where('[subjectType+subjectId]').equals(['MAINTENANCE_OCCURRENCE', occurrenceId]).sortBy('createdAt'),
    db.records.bulkGet(occurrence.repairRecordIds),
    db.auditEvents.where('[subjectType+subjectId]').equals(['MAINTENANCE_OCCURRENCE', occurrenceId]).sortBy('createdAt'),
    db.users.toArray(),
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const isFinal = ['COMPLETED', 'CANCELLED'].includes(occurrence.status);
  return {
    occurrence,
    plan,
    item,
    submissions,
    reviews,
    attachments,
    repairs: repairs.filter((row): row is RepairRecord => Boolean(row)),
    audit: audit.reverse(),
    indicator: occurrenceIndicator(occurrence),
    inactiveSlots: isFinal ? [] : unassignableSlots({ ...occurrence, locationId: item?.locationId }, usersById),
  };
};
