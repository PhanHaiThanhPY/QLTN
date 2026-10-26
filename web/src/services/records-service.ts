import { LIMITS, REPAIR_FINAL_STATUSES, REPAIR_STATUS_GROUP_BY_STATUS } from '@/domain/constants';
import type { RepairStatus, RepairStatusGroup } from '@/domain/constants';
import { unassignableSlots } from '@/domain/task-rules';
import type {
  Acceptance,
  ApprovalDecision,
  Attachment,
  AuditEvent,
  BuildingConfig,
  Construction,
  MaintenanceItem,
  MaintenanceOccurrence,
  Payment,
  PaymentDraft,
  PaymentRequest,
  ProposalDraft,
  RepairConfirmation,
  RepairRecord,
  ProposalSignature,
  UnresolvedNotice,
  Submission,
} from '@/domain/types';
import type { IsoDate } from '@/domain/types';
import type { AssigneeSlot } from '@/domain/permissions';
import { computeRepairAlerts } from '@/domain/repair-alerts';
import { RECORD_ITEM_LINK, recordItemLink } from '@/domain/record-item-link';
import type { ItemRepairHistory, RepairAlert } from '@/domain/repair-alerts';
import { IS_API_MODE } from '@/config/data-source';
import { getDb } from '@/storage/db';
import { toVnDate } from '@/utils/date';
import { apiList, apiRequest } from './http/client';
import type { ExecutionHistory } from '@/domain/execution';
import type { PaymentHistory } from '@/domain/payment';
import type { QuoteProposalHistory } from '@/domain/quote-proposal';
import { mapRecordDetail, mapRepairRecord } from './http/mappers';
import type { ApiRecordDetail, ApiRepairRecord } from './http/mappers';
import { now } from './runtime';
import { todayVn } from './runtime';
import { assertInScope, requireViewer, scopedBuildingIds } from './viewer';

export interface RecordFilters {
  q?: string;
  buildingId?: string;
  status?: RepairStatus | '';
  statusGroup?: RepairStatusGroup | '';
  locationId?: string;
  assigneeId?: string;
  maintenanceItemId?: string;
  /** UNLINKED = records with neither an item nor "Không thuộc thiết bị cụ thể" (report link `itemLink=unlinked`). */
  itemLink?: typeof RECORD_ITEM_LINK.UNLINKED;
  dateFrom?: string;
  dateTo?: string;
  /** Only open records whose due time has passed. */
  overdue?: boolean;
  /** api mode: only records outside the final statuses (count card "hồ sơ đang mở"). */
  open?: boolean;
  /** api mode: records waiting for the manager to supplement something (count card "hồ sơ cần bổ sung"). */
  attention?: 'needs_update';
  page?: number;
  pageSize?: number;
}

export interface RecordListItem {
  record: RepairRecord;
  isOverdue: boolean;
  needsReassignment: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const isRecordOverdue = (record: RepairRecord, at: Date = now()): boolean =>
  Boolean(record.dueAt) && !REPAIR_FINAL_STATUSES.includes(record.status) && new Date(record.dueAt as string) < at;

/** Same list as api-qltn `RECORD_NEEDS_UPDATE_STATUSES` (card "cần bổ sung"). */
const NEEDS_UPDATE_STATUSES: readonly RepairStatus[] = [
  'NEEDS_RECORD_UPDATE',
  'NEEDS_SUBMISSION_UPDATE',
  'NEEDS_PAYMENT_UPDATE',
  'NEEDS_REPAIR',
  'UNRESOLVED',
];

const matchesFilters = (record: RepairRecord, filters: RecordFilters): boolean => {
  const q = filters.q?.trim().toLowerCase();
  if (q && !record.code.toLowerCase().includes(q) && !record.title.toLowerCase().includes(q)) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.statusGroup && REPAIR_STATUS_GROUP_BY_STATUS[record.status] !== filters.statusGroup) return false;
  if (filters.open && REPAIR_FINAL_STATUSES.includes(record.status)) return false;
  if (filters.attention === 'needs_update' && !NEEDS_UPDATE_STATUSES.includes(record.status)) return false;
  if (filters.locationId && record.locationId !== filters.locationId) return false;
  if (filters.maintenanceItemId && record.maintenanceItemId !== filters.maintenanceItemId) return false;
  if (filters.itemLink && recordItemLink(record) !== filters.itemLink) return false;
  const assignees = [
    record.managerUserId,
    record.confirmationUserId,
    record.consultantUserId,
    record.boardUserId,
  ];
  if (filters.assigneeId && !assignees.includes(filters.assigneeId)) return false;
  const created = toVnDate(record.createdAt);
  if (filters.dateFrom && created < filters.dateFrom) return false;
  if (filters.dateTo && created > filters.dateTo) return false;
  return true;
};

/**
 * api mode: the backend pages, searches and filters (`GET /records`); `meta` is the source of the page numbers.
 * Fields the backend does not have (`overdue`, `maintenanceItemId`, `itemLink`) are not sent, and the
 * server-side flags are left `false` on purpose (T4b/Đợt 3 will supply them).
 */
const listApiRecords = async (filters: RecordFilters): Promise<Page<RecordListItem>> => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? LIMITS.PAGE_SIZE;
  const result = await apiList<ApiRepairRecord>('GET', '/records', {
    query: {
      page,
      limit: pageSize,
      search: filters.q?.trim() || undefined,
      buildingId: filters.buildingId || undefined,
      statusGroup: filters.statusGroup || undefined,
      status: filters.status || undefined,
      locationId: filters.locationId || undefined,
      assigneeId: filters.assigneeId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      open: filters.open ? 1 : undefined,
      attention: filters.attention,
    },
  });
  const meta = result.meta ?? { page, limit: pageSize, total: result.data.length, totalPages: 1 };
  return {
    items: result.data.map((row) => ({ record: mapRepairRecord(row), isOverdue: false, needsReassignment: false })),
    total: meta.total,
    page: meta.page,
    pageSize: meta.limit,
  };
};

/** Lists records inside the viewer's buildings with filters and pagination. */
export const listRecords = async (filters: RecordFilters = {}): Promise<Page<RecordListItem>> => {
  if (IS_API_MODE) return listApiRecords(filters);
  const viewer = await requireViewer();
  const db = getDb();
  const buildingIds = scopedBuildingIds(viewer, filters.buildingId);
  const [records, users] = await Promise.all([
    db.records.where('buildingId').anyOf(buildingIds).toArray(),
    db.users.toArray(),
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const at = now();
  const matched = records
    .filter((record) => matchesFilters(record, filters))
    .filter((record) => !filters.overdue || isRecordOverdue(record, at))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pageSize = filters.pageSize ?? LIMITS.PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const items = matched.slice((page - 1) * pageSize, page * pageSize).map((record) => ({
    record,
    isOverdue: isRecordOverdue(record, at),
    needsReassignment:
      !REPAIR_FINAL_STATUSES.includes(record.status) && unassignableSlots(record, usersById).length > 0,
  }));
  return { items, total: matched.length, page, pageSize };
};

/** Counters behind the card row on `/records` (`GET /records/summary`, api mode only). */
export interface RecordSummary {
  open: number;
  needsUpdate: number;
  completed: number;
  total: number;
  /** Instant the server counted at (ISO); the screen prints it as the "as of" line. */
  asOf: string;
}

/**
 * api mode: cards read one server-side query in the caller's building scope.
 * Mock mode keeps its own count of the demo database on the page (unchanged).
 */
export const getRecordSummary = async (filters: Pick<RecordFilters, 'buildingId'> = {}): Promise<RecordSummary> =>
  apiRequest<RecordSummary>('GET', '/records/summary', {
    query: { buildingId: filters.buildingId || undefined },
  });

export interface RepairScheduleFilters {
  buildingId?: string;
  locationId?: string;
  statusGroup?: RepairStatusGroup | '';
  dateFrom?: IsoDate;
  dateTo?: IsoDate;
  page?: number;
  pageSize?: number;
}

export interface RepairScheduleListItem extends RecordListItem {
  construction?: Construction;
  scheduledDate?: IsoDate;
}

const repairScheduleDate = (record: RepairRecord, construction?: Construction): IsoDate | undefined =>
  construction?.startDate ?? (record.dueAt ? toVnDate(record.dueAt) : undefined);

/** Lists repair records by their construction window or task due date for the separate repair calendar. */
export const listRepairSchedule = async (filters: RepairScheduleFilters = {}): Promise<Page<RepairScheduleListItem>> => {
  const viewer = await requireViewer();
  const db = getDb();
  const buildingIds = scopedBuildingIds(viewer, filters.buildingId);
  const [records, users] = await Promise.all([
    db.records.where('buildingId').anyOf(buildingIds).toArray(),
    db.users.toArray(),
  ]);
  const constructions = records.length ? await db.constructions.where('recordId').anyOf(records.map((record) => record.id)).toArray() : [];
  const constructionByRecord = new Map(constructions.map((construction) => [construction.recordId, construction]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const today = todayVn();
  const matched = records
    .filter((record) => !filters.locationId || record.locationId === filters.locationId)
    .filter((record) => !filters.statusGroup || REPAIR_STATUS_GROUP_BY_STATUS[record.status] === filters.statusGroup)
    .map((record): RepairScheduleListItem => {
      const construction = constructionByRecord.get(record.id);
      return {
        record,
        construction,
        scheduledDate: repairScheduleDate(record, construction),
        isOverdue: isRecordOverdue(record) || Boolean(construction && construction.plannedEndDate < today && !REPAIR_FINAL_STATUSES.includes(record.status)),
        needsReassignment:
          !REPAIR_FINAL_STATUSES.includes(record.status) && unassignableSlots(record, usersById).length > 0,
      };
    })
    .filter((row) => !filters.dateFrom || !row.scheduledDate || row.scheduledDate >= filters.dateFrom)
    .filter((row) => !filters.dateTo || !row.scheduledDate || row.scheduledDate <= filters.dateTo)
    .sort((a, b) => (a.scheduledDate ?? '9999-12-31').localeCompare(b.scheduledDate ?? '9999-12-31'));
  const pageSize = filters.pageSize ?? LIMITS.PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  return { items: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length, page, pageSize };
};

export interface SubmissionView {
  submission: Submission;
  decisions: ApprovalDecision[];
}

export interface RecordDetail {
  record: RepairRecord;
  confirmations: RepairConfirmation[];
  proposalDraft?: ProposalDraft;
  submissions: SubmissionView[];
  /** S2 proposal with a quotation table; present only when the detail comes from api-qltn. */
  quoteProposal?: QuoteProposalHistory;
  /** S3 construction and acceptance minutes; present only when the detail comes from api-qltn. */
  execution?: ExecutionHistory;
  /** S4 payment instalments; present only when the detail comes from api-qltn (`payments` is the demo's list). */
  paymentHistory?: PaymentHistory;
  signatures: ProposalSignature[];
  notice?: UnresolvedNotice;
  alerts: RepairAlert[];
  /** Current configuration of the record's building (emergency limit and hours shown in the UI). */
  buildingConfig?: BuildingConfig;
  construction?: Construction;
  acceptances: Acceptance[];
  paymentDraft?: PaymentDraft;
  paymentRequests: PaymentRequest[];
  payments: Payment[];
  attachments: Attachment[];
  audit: AuditEvent[];
  item?: MaintenanceItem;
  sourceOccurrence?: MaintenanceOccurrence;
  inactiveSlots: AssigneeSlot[];
  isOverdue: boolean;
}

/** Other repairs of the same item in the same building, with their approved amounts. */
const itemHistory = async (record: RepairRecord): Promise<ItemRepairHistory[]> => {
  if (!record.maintenanceItemId) return [];
  const db = getDb();
  const others = await db.records
    .where('maintenanceItemId')
    .equals(record.maintenanceItemId)
    .filter((row) => row.id !== record.id && row.buildingId === record.buildingId)
    .toArray();
  const approved = await db.submissions.bulkGet(others.map((row) => row.approvedSubmissionId ?? ''));
  return others.map((row, index) => ({ record: row, approvedAmount: approved[index]?.amountVnd }));
};

const byRecord = <T extends { recordId: string }>(rows: T[], id: string): T[] => rows.filter((row) => row.recordId === id);

/** Full record view; a record outside the viewer's buildings is reported as not found. */
export const getRecordDetail = async (recordId: string): Promise<RecordDetail> => {
  if (IS_API_MODE) {
    return mapRecordDetail(await apiRequest<ApiRecordDetail>('GET', `/records/${encodeURIComponent(recordId)}`));
  }
  const viewer = await requireViewer();
  const db = getDb();
  const record = assertInScope(viewer, await db.records.get(recordId));
  const [
    confirmations,
    proposalDraft,
    submissions,
    decisions,
    signatures,
    construction,
    acceptances,
    paymentDraft,
    paymentRequests,
    payments,
    attachments,
    audit,
    users,
  ] = await Promise.all([
    db.repairConfirmations.where('recordId').equals(recordId).sortBy('createdAt'),
    db.proposalDrafts.where('recordId').equals(recordId).first(),
    db.submissions.where('recordId').equals(recordId).sortBy('attemptNo'),
    db.approvalDecisions.where('recordId').equals(recordId).sortBy('createdAt'),
    db.signatures.where('recordId').equals(recordId).toArray(),
    db.constructions.where('recordId').equals(recordId).first(),
    db.acceptances.where('recordId').equals(recordId).sortBy('roundNo'),
    db.paymentDrafts.where('recordId').equals(recordId).first(),
    db.paymentRequests.where('recordId').equals(recordId).sortBy('revisionNo'),
    db.payments.where('recordId').equals(recordId).toArray(),
    db.attachments.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', recordId]).sortBy('createdAt'),
    db.auditEvents.where('[subjectType+subjectId]').equals(['REPAIR_RECORD', recordId]).sortBy('createdAt'),
    db.users.toArray(),
  ]);
  const item = record.maintenanceItemId ? await db.maintenanceItems.get(record.maintenanceItemId) : undefined;
  const [history, notice, config] = await Promise.all([
    itemHistory(record),
    db.notices.where('recordId').equals(recordId).first(),
    db.buildingConfigs.get(record.buildingId),
  ]);
  const current = submissions.find((row) => row.id === record.currentSubmissionId);
  const amount = current?.amountVnd ?? proposalDraft?.amountVnd;
  const sourceOccurrence = record.sourceMaintenanceOccurrenceId
    ? await db.occurrences.get(record.sourceMaintenanceOccurrenceId)
    : undefined;
  const usersById = new Map(users.map((user) => [user.id, user]));
  return {
    record,
    confirmations,
    proposalDraft,
    submissions: submissions.map((submission) => ({
      submission,
      decisions: decisions.filter((decision) => decision.submissionId === submission.id),
    })),
    signatures: byRecord(signatures, recordId),
    notice,
    alerts: computeRepairAlerts({ record, item, history, amount, rules: config }),
    buildingConfig: config,
    construction,
    acceptances,
    paymentDraft,
    paymentRequests,
    payments,
    attachments,
    audit: audit.reverse(),
    item,
    sourceOccurrence,
    inactiveSlots: REPAIR_FINAL_STATUSES.includes(record.status) ? [] : unassignableSlots(record, usersById),
    isOverdue: isRecordOverdue(record),
  };
};
