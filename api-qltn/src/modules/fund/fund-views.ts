import { maskAccount, type MonthFigures } from '../../domain/fund-ledger';
import type { FundLedgerEntry, LedgerCategory, LedgerSourceType } from './entities/fund-ledger-entry.entity';
import type { Fund, FundKind, PendingOpening } from './entities/fund.entity';

export interface FundView {
  id: string;
  buildingId: string;
  kind: FundKind;
  bankName: string | null;
  accountNo: string | null;
  /** "****0001" for headers (BR-F3-02). */
  accountMasked: string | null;
  accountHolder: string | null;
  openingDate: string | null;
  openingBalanceVnd: string | null;
  pendingOpening: PendingOpening | null;
  /** Whether the ledger already has lines (an opening change then waits for BQT, D-F3-5). */
  hasLines: boolean;
  version: number;
}

export interface LedgerRow {
  id: string;
  entryDate: string;
  direction: 'IN' | 'OUT';
  amountVnd: string;
  category: LedgerCategory;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceCode: string;
  description: string;
  /** BR-F3-04: "Đảo của …" on a reversal; "Đã hủy" on the line it reverses. */
  reversesId: string | null;
  reversedById: string | null;
  reconciliation: 'UNRECONCILED' | 'RECONCILED';
  createdBy: string;
  createdAt: Date;
}

export interface LedgerPage {
  fund: FundView;
  month: string;
  /** Null for a month that ends before the ledger starts. */
  figures: (MonthFigures & { incomeVnd: string; depositHeldVnd: string }) | null;
  /** The "Số dư đầu" line when the ledger starts in this month. */
  openingLine: { date: string; amountVnd: string } | null;
  rows: LedgerRow[];
}

export const fundView = (fund: Fund, hasLines: boolean): FundView => ({
  id: fund.id,
  buildingId: fund.buildingId,
  kind: fund.kind,
  bankName: fund.bankName,
  accountNo: fund.accountNo,
  accountMasked: maskAccount(fund.accountNo),
  accountHolder: fund.accountHolder,
  openingDate: fund.openingDate,
  openingBalanceVnd: fund.openingBalanceVnd,
  pendingOpening: fund.pendingOpening,
  hasLines,
  version: fund.version,
});

export const ledgerRow = (entry: FundLedgerEntry, reversedById: string | null): LedgerRow => ({
  id: entry.id,
  entryDate: entry.entryDate,
  direction: entry.direction,
  amountVnd: entry.amountVnd,
  category: entry.category,
  sourceType: entry.sourceType,
  sourceId: entry.sourceId,
  sourceCode: entry.sourceCode,
  description: entry.description,
  reversesId: entry.reversesId,
  reversedById,
  reconciliation: entry.reconciliation,
  createdBy: entry.createdBy,
  createdAt: entry.createdAt,
});
