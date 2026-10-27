import { maskAccount, type MonthFigures } from '../../domain/fund-ledger';
import type { FundLedgerEntry, LedgerCategory, LedgerSourceType } from './entities/fund-ledger-entry.entity';
import type { Fund, FundKind, PendingOpening } from './entities/fund.entity';

export interface FundView {
  id: string;
  buildingId: string;
  kind: FundKind;
  bankName: string | null;
  /** BR-F3-02: the full number for Kế toán and BQT only; null for anyone else. */
  accountNo: string | null;
  /** "****0001": the last four digits, for anyone else. */
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
  /** The contract behind an exploitation receipt or deposit, for the code's link. */
  contractId: string | null;
  /** F-S4 BR-F4-11: the bank line (GD-…) it is matched with. */
  statementCode: string | null;
  /** F-S5 BR-F5-10: a deposit offset's line ("Nội bộ"). */
  internal: boolean;
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

export const fundView = (fund: Fund, hasLines: boolean, fullAccount: boolean): FundView => ({
  id: fund.id,
  buildingId: fund.buildingId,
  kind: fund.kind,
  bankName: fund.bankName,
  accountNo: fullAccount ? fund.accountNo : null,
  accountMasked: maskAccount(fund.accountNo),
  accountHolder: fund.accountHolder,
  openingDate: fund.openingDate,
  openingBalanceVnd: fund.openingBalanceVnd,
  pendingOpening: fund.pendingOpening,
  hasLines,
  version: fund.version,
});

export const ledgerRow = (
  entry: FundLedgerEntry,
  reversedById: string | null,
  contractId: string | null,
  statementCode: string | null = null,
): LedgerRow => ({
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
  contractId,
  statementCode,
  internal: entry.internal,
  createdBy: entry.createdBy,
  createdAt: entry.createdAt,
});
