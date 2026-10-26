import { apiList, apiRequest } from './client';
import type { ApiAuditEvent } from './mappers';

/** One row of the account history block (SPEC US-S1 §3.2). */
export interface AccountHistoryRow {
  id: string;
  action: string;
  /** Full name of the actor; empty when the change came from the system. */
  actorName: string;
  reason: string;
  createdAt: string;
}

export interface AccountHistoryPage {
  rows: AccountHistoryRow[];
  page: number;
  totalPages: number;
}

export const ACCOUNT_HISTORY_PAGE_SIZE = 20;

const toHistoryRow = (row: ApiAuditEvent): AccountHistoryRow => ({
  id: row.id,
  action: row.action,
  actorName: row.actorName ?? '',
  reason: row.reason ?? '',
  createdAt: row.createdAt,
});

/** Subjects with a history block: accounts (US-S1), roles and departments (AD-S1). */
export type HistorySubject = 'users' | 'roles' | 'departments';

/** `GET /<subject>/:id/audit`, newest first, `ACCOUNT_HISTORY_PAGE_SIZE` rows per page. */
export const listAccountHistory = async (
  subjectId: string,
  page: number,
  subject: HistorySubject = 'users',
): Promise<AccountHistoryPage> => {
  const result = await apiList<ApiAuditEvent>('GET', `/${subject}/${encodeURIComponent(subjectId)}/audit`, {
    query: { page, limit: ACCOUNT_HISTORY_PAGE_SIZE },
  });
  return {
    rows: result.data.map(toHistoryRow),
    page: result.meta?.page ?? page,
    totalPages: result.meta?.totalPages ?? page,
  };
};

/** `POST /users/:id/reset-password`; the backend signs the account out everywhere and audits `resetPassword`. */
export const resetUserPassword = async (userId: string, password: string): Promise<void> => {
  await apiRequest<{ reset: true }>('POST', `/users/${encodeURIComponent(userId)}/reset-password`, {
    body: { password },
  });
};
