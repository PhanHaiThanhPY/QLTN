import type { Attachment, AuditEvent, IsoDate } from '@/domain/types';
import { apiRequest } from './http/client';
import { mapAttachment, mapAuditEvent } from './http/mappers';
import type { ApiAttachment, ApiAuditEvent } from './http/mappers';
import type { ApiChecklistItem } from './maintenance-plans-api';

/** SPEC MT-S3 shapes as the API answers them (api mode only). */
export type OccurrenceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'REWORK' | 'COMPLETED' | 'CANCELLED';
export type CheckResult = 'PASS' | 'FAIL' | 'NA';

export interface WorkEntry {
  itemId: string;
  result: CheckResult | null;
  value: number | null;
  note: string | null;
  attachmentIds: string[];
}

export interface OccurrenceWork {
  entries: WorkEntry[];
  summary: string | null;
  actualWorker: string | null;
  attachmentIds: string[];
}

export interface ExecutionOccurrence {
  id: string;
  code: string;
  planId: string;
  itemId: string;
  buildingId: string;
  scheduledDate: IsoDate;
  periodDate: IsoDate | null;
  status: OccurrenceStatus;
  isMakeup: boolean;
  cancelReason: string | null;
  performerUserId: string;
  reviewerUserId: string;
  contractorName: string | null;
  checklist: ApiChecklistItem[];
  work: OccurrenceWork;
  round: number;
  /** Items sent back on the latest rework: { itemId: reason }. */
  rework: Record<string, string>;
  startedAt: string | null;
  submittedAt: string | null;
  reviewDueAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  overdueDays: number;
  reviewOverdue: boolean;
  version: number;
}

export interface Submission {
  round: number;
  entries: WorkEntry[];
  summary: string;
  contractorName: string | null;
  actualWorker: string | null;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: string;
  reviewDueAt: string;
  decision: 'REWORK' | 'CONFIRMED' | null;
  decisionReason: string | null;
  reworkItems: Record<string, string>;
  resolutions: Record<string, string>;
  conditionAfter: string | null;
  conditionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface LinkedRepair {
  id: string;
  code: string;
  status: string;
  itemId: string | null;
  inForce: boolean;
}

export interface OccurrenceDetail {
  occurrence: ExecutionOccurrence;
  plan: { id: string; code: string; name: string; managerUserId: string };
  item: { id: string; code: string; name: string; locationId: string; condition: string; active: boolean };
  /** Newest first. */
  submissions: Submission[];
  repairs: LinkedRepair[];
  files: Record<string, Attachment>;
  audit: AuditEvent[];
}

export interface OccurrenceRow {
  id: string;
  code: string;
  status: OccurrenceStatus;
  scheduledDate: IsoDate;
  reviewDueAt: string | null;
  isMakeup: boolean;
  performerUserId: string;
  reviewerUserId: string;
  buildingId: string;
  plan: { id: string; code: string; name: string };
  item: { id: string; code: string; name: string; locationId: string };
  overdueDays: number;
  reviewOverdue: boolean;
  version: number;
}

export interface OccurrenceCounts {
  overdue: number;
  today: number;
  next7: number;
  pendingReview: number;
}

export type OccurrenceBucket = 'OVERDUE' | 'TODAY' | 'NEXT_7' | 'PENDING_REVIEW';

export interface OccurrenceFilters {
  scope: 'mine' | 'all';
  buildingId?: string;
  status?: OccurrenceStatus;
  bucket?: OccurrenceBucket;
  from?: IsoDate;
  to?: IsoDate;
}

export const getOccurrenceDetail = async (id: string): Promise<OccurrenceDetail> => {
  const body = await apiRequest<Omit<OccurrenceDetail, 'files' | 'audit'> & { files: Record<string, ApiAttachment>; audit: ApiAuditEvent[] }>(
    'GET',
    `/maintenance-occurrences/${encodeURIComponent(id)}`,
  );
  return {
    ...body,
    files: Object.fromEntries(Object.entries(body.files).map(([key, file]) => [key, mapAttachment(file)])),
    audit: body.audit.map(mapAuditEvent),
  };
};

export const listOccurrences = (filters: OccurrenceFilters): Promise<{ rows: OccurrenceRow[]; counts: OccurrenceCounts }> =>
  apiRequest('GET', '/maintenance-occurrences', {
    query: {
      scope: filters.scope,
      buildingId: filters.buildingId || undefined,
      status: filters.status,
      bucket: filters.bucket,
      from: filters.from || undefined,
      to: filters.to || undefined,
    },
  });
