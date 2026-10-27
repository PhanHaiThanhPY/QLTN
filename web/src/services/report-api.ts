import type { Attachment } from '@/domain/types';
import { apiRequest, apiRequestBlob } from './http/client';
import { mapAttachment, type ApiAttachment } from './http/mappers';
import type { Voucher } from './fund-api';

/** SPEC F-S5 shapes as the API answers them (api mode only). Money is integer VND as a string. */
export type ReportKind = 'MONTH' | 'QUARTER' | 'YEAR' | 'RANGE';

export interface ReportDocument {
  entryId: string;
  date: string;
  code: string;
  description: string;
  amountVnd: string;
  direction: 'IN' | 'OUT';
  statementCode: string | null;
  internal: boolean;
}

export interface FundReport {
  fund: { id: string; buildingId: string; accountMasked: string | null };
  period: { kind: ReportKind; value: string; from: string; to: string; label: string; slug: string };
  computedAt: string;
  source: 'STATEMENT' | 'LEDGER';
  unreconciled: Array<{ month: string; differenceVnd: string | null }>;
  figures: { openingVnd: string; inVnd: string; outVnd: string; closingVnd: string };
  sources: Array<{ direction: 'IN' | 'OUT'; category: string; label: string; amountVnd: string; documents: ReportDocument[] }>;
  byContract: Array<{ contractId: string; code: string; partner: string; amountVnd: string; offsetVnd: string }>;
  outstanding: Array<{ contractId: string; code: string; partner: string; periodNo: number; dueDate: string; remainingVnd: string; overdueDays: number }>;
  outstandingVnd: string;
  depositHeldVnd: string;
  writeOffs: Array<{ contractId: string; code: string; partner: string; writeOffCode: string; approvedOn: string; amountVnd: string }>;
  writeOffVnd: string;
  ledger: ReportDocument[];
  openingLine: { date: string; amountVnd: string } | null;
}

export interface CloseCheck {
  key: 'HANDOVER' | 'MINUTES' | 'RECEIVABLES' | 'DEPOSIT' | 'PENDING';
  ok: boolean;
  detail: string;
  amountVnd?: string;
}

export interface Termination {
  id: string;
  code: string;
  contractId: string;
  reason: 'EXPIRED' | 'EARLY_AGREED' | 'EARLY_BREACH';
  note: string;
  terminationDate: string;
  status: 'OPEN' | 'CANCELLED' | 'CLOSED';
  minutesAttachmentId: string | null;
  minutesSignedOn: string | null;
  minutesHistory: Array<{ attachmentId: string; signedOn: string; replacedAt: string; replacedBy: string }>;
  closedAt: string | null;
  version: number;
}

export interface Handover {
  id: string;
  code: string;
  handedOn: string;
  result: 'PASSED' | 'FAILED';
  note: string | null;
  attachmentId: string;
  createdBy: string;
}

export interface Settlement {
  id: string;
  code: string;
  amountVnd: string;
  allocations: Array<{ receivableId: string; amountVnd: string }>;
  status: string;
  version: number;
}

export interface DepositOffset extends Settlement {
  offsetOn: string;
  note: string | null;
}

export interface WriteOff extends Settlement {
  reason: string;
  attachmentId: string | null;
  approvedOn: string | null;
  proposedBy: string;
  decisions: Array<{ decision: string; reason: string | null; by: string; at: string }>;
}

export interface TerminationView {
  termination: Termination | null;
  handovers: Handover[];
  offsets: DepositOffset[];
  writeOffs: WriteOff[];
  refunds: Voucher[];
  checks: CloseCheck[];
  canClose: boolean;
  remainingVnd: string;
  depositHeldVnd: string;
  files: Record<string, Attachment>;
}

export interface ReportQuery {
  fundId: string;
  kind: ReportKind;
  value: string;
}

export const getFundReport = (query: ReportQuery): Promise<FundReport> => apiRequest('GET', '/exploitation/report', { query: { ...query } });

/** BR-F5-05: the XLSX, fetched with the session. */
export const downloadFundReport = (query: ReportQuery): Promise<Blob> =>
  apiRequestBlob(`/exploitation/report/export?${new URLSearchParams({ ...query }).toString()}`);

export const getTermination = async (contractId: string): Promise<TerminationView> => {
  const body = await apiRequest<Omit<TerminationView, 'files'> & { files: Record<string, ApiAttachment> }>(
    'GET',
    `/exploitation/contracts/${encodeURIComponent(contractId)}/termination`,
  );
  return { ...body, files: Object.fromEntries(Object.entries(body.files).map(([key, file]) => [key, mapAttachment(file)])) };
};
