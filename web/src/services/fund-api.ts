import type { AuditEvent, Attachment } from '@/domain/types';
import { apiRequest } from './http/client';
import { mapAttachment, mapAuditEvent } from './http/mappers';
import type { ApiAttachment, ApiAuditEvent } from './http/mappers';

/** SPEC F-S3 shapes as the API answers them (api mode only). Money is integer VND as a string; the server sums it. */
/** F-S4 adds BANK_FEE and INTEREST, recorded from the bank statement. */
export type LedgerCategory = 'CONTRACT_RECEIPT' | 'DEPOSIT' | 'TAX' | 'SERVICE' | 'TRANSFER' | 'OTHER' | 'BANK_FEE' | 'INTEREST';
export type LedgerDirection = 'IN' | 'OUT';
export type VoucherCategory = 'SERVICE' | 'TRANSFER' | 'OTHER';
export type VoucherStatus = 'DRAFT' | 'PENDING' | 'NEEDS_CHANGES' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';

export interface Fund {
  id: string;
  buildingId: string;
  kind: 'KHAI_THAC' | 'BAO_TRI';
  bankName: string | null;
  /** BR-F3-02: full for Kế toán and BQT, null for anyone else. */
  accountNo: string | null;
  accountMasked: string | null;
  accountHolder: string | null;
  openingDate: string | null;
  openingBalanceVnd: string | null;
  pendingOpening: { openingDate: string; openingBalanceVnd: string; reason: string; requestedBy: string; requestedAt: string } | null;
  hasLines: boolean;
  version: number;
}

export interface LedgerRow {
  id: string;
  entryDate: string;
  direction: LedgerDirection;
  amountVnd: string;
  category: LedgerCategory;
  sourceType: 'RECEIPT' | 'DEPOSIT' | 'TAX_PAYMENT' | 'VOUCHER' | 'STATEMENT';
  sourceId: string;
  sourceCode: string;
  description: string;
  reversesId: string | null;
  reversedById: string | null;
  reconciliation: 'UNRECONCILED' | 'RECONCILED';
  contractId: string | null;
  /** F-S4 BR-F4-11: the bank line it is matched with. */
  statementCode: string | null;
  createdBy: string;
  createdAt: string;
}

export interface LedgerFigures {
  openingVnd: string;
  inVnd: string;
  outVnd: string;
  closingVnd: string;
  incomeVnd: string;
  depositHeldVnd: string;
}

export interface LedgerPage {
  fund: Fund;
  month: string;
  figures: LedgerFigures | null;
  openingLine: { date: string; amountVnd: string } | null;
  rows: LedgerRow[];
}

export interface TaxObligation {
  id: string;
  code: string;
  fundId: string;
  month: string;
  amountVnd: string;
  attachmentId: string | null;
  note: string | null;
  adjustments: Array<{ fromVnd: string; toVnd: string; reason: string; by: string; at: string }>;
  paidVnd: string;
  remainingVnd: string;
  settled: boolean;
  /** F-S4 BR-F4-11: "Đã đối chiếu k/n". */
  reconciled: { matched: number; total: number };
  version: number;
}

export interface TaxPayment {
  id: string;
  code: string;
  obligationId: string;
  paidOn: string;
  amountVnd: string;
  attachmentId: string;
  status: 'RECORDED' | 'CANCELLED';
  cancelReason: string | null;
  statementCode: string | null;
  version: number;
}

export interface TaxMonth {
  fundId: string;
  month: string;
  obligation: TaxObligation | null;
  payments: TaxPayment[];
  contractIncomeVnd: string;
  files: Record<string, Attachment>;
}

export interface Voucher {
  id: string;
  code: string;
  fundId: string;
  buildingId: string;
  category: VoucherCategory;
  targetFundKind: 'BAO_TRI' | null;
  content: string;
  payeeName: string;
  payeeAccount: string | null;
  amountVnd: string;
  requestAttachmentId: string;
  status: VoucherStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  paidOn: string | null;
  proofAttachmentId: string | null;
  cancelRequest: { reason: string; requestedBy: string; requestedAt: string } | null;
  cancelReason: string | null;
  /** F-S4 BR-F4-11: the bank line a paid voucher is matched with. */
  statementCode: string | null;
  createdBy: string;
  createdAt: string;
  version: number;
}

export interface VoucherCounts {
  pending: number;
  approved: number;
  paidThisMonthVnd: string;
  rejected: number;
}

export interface VoucherDecision {
  id: string;
  decision: string;
  reason: string | null;
  decidedBy: string;
  decidedAt: string;
}

export interface VoucherDetail {
  voucher: Voucher;
  decisions: VoucherDecision[];
  files: Record<string, Attachment>;
  audit: AuditEvent[];
}

const mapFiles = (files: Record<string, ApiAttachment>): Record<string, Attachment> =>
  Object.fromEntries(Object.entries(files).map(([key, file]) => [key, mapAttachment(file)]));
const fundPath = (id: string, suffix = ''): string => `/funds/${encodeURIComponent(id)}${suffix}`;

export const listFunds = (): Promise<Fund[]> => apiRequest('GET', '/funds');

export const getLedger = (
  fundId: string,
  month: string,
  filters: { category?: LedgerCategory; direction?: LedgerDirection } = {},
): Promise<LedgerPage> => apiRequest('GET', fundPath(fundId, '/ledger'), { query: { month, category: filters.category, direction: filters.direction } });

/** BR-F3-13 preview: what may leave the fund on that day without any day going below zero. */
export const getAvailable = (fundId: string, date: string): Promise<{ amountVnd: string; date: string }> =>
  apiRequest('GET', fundPath(fundId, '/available'), { query: { date } });

export const getTaxMonth = async (fundId: string, month: string): Promise<TaxMonth> => {
  const body = await apiRequest<Omit<TaxMonth, 'files'> & { files: Record<string, ApiAttachment> }>('GET', fundPath(fundId, '/taxes'), { query: { month } });
  return { ...body, files: mapFiles(body.files) };
};

export const listVouchers = (fundId: string, month: string): Promise<{ rows: Voucher[]; counts: VoucherCounts }> =>
  apiRequest('GET', fundPath(fundId, '/vouchers'), { query: { month } });

export const getVoucher = async (id: string): Promise<VoucherDetail> => {
  const body = await apiRequest<Omit<VoucherDetail, 'files' | 'audit'> & { files: Record<string, ApiAttachment>; audit: ApiAuditEvent[] }>(
    'GET',
    `/funds/vouchers/${encodeURIComponent(id)}`,
  );
  return { ...body, files: mapFiles(body.files), audit: body.audit.map(mapAuditEvent) };
};
