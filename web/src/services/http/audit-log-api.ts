import { apiList, apiRequestBlob } from './client';

/** Filters of the operation log (SPEC AD-S1 §3); empty strings mean "not filtered". */
export interface AuditLogFilters {
  buildingId: string;
  dateFrom: string;
  dateTo: string;
  actorId: string;
  subjectType: string;
  action: string;
  subjectCode: string;
}

/** One row of `GET /audit-events`. */
export interface AuditLogRow {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectCode: string | null;
  buildingId: string | null;
  buildingCode: string | null;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorCode: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  total: number;
}

export const AUDIT_PAGE_SIZE = 50;

const toQuery = (filters: AuditLogFilters): Record<string, string> =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, value.trim()]));

/** `GET /audit-events`, newest first, 50 rows per page. */
export const listAuditEvents = async (filters: AuditLogFilters, page: number): Promise<AuditLogPage> => {
  const result = await apiList<AuditLogRow>('GET', '/audit-events', {
    query: { ...toQuery(filters), page, limit: AUDIT_PAGE_SIZE },
  });
  return { rows: result.data, total: result.meta?.total ?? result.data.length };
};

/** `GET /audit-events/export` with the same filters; a result above 10 000 rows answers a 400 with the count. */
export const exportAuditEvents = async (filters: AuditLogFilters): Promise<Blob> =>
  apiRequestBlob(`/audit-events/export?${new URLSearchParams(toQuery(filters)).toString()}`);
