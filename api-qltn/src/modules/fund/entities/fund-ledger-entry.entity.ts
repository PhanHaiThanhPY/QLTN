import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { LedgerDirection } from '../../../domain/fund-ledger';

/** F-S4 BR-F4-08 adds BANK_FEE (out) and INTEREST (in), recorded from the statement; F-S5 DEPOSIT_REFUND. */
export const LEDGER_CATEGORIES = [
  'CONTRACT_RECEIPT',
  'DEPOSIT',
  'TAX',
  'SERVICE',
  'TRANSFER',
  'OTHER',
  'BANK_FEE',
  'INTEREST',
  'DEPOSIT_REFUND',
] as const;
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];
export type LedgerSourceType = 'RECEIPT' | 'DEPOSIT' | 'TAX_PAYMENT' | 'VOUCHER' | 'STATEMENT' | 'DEPOSIT_OFFSET';

/**
 * One movement of money in or out of a fund's account (SPEC F-S3 BR-F3-03). Never updated or deleted (a database
 * trigger refuses it); a mistake is a reversal line pointing at its original (BR-F3-04).
 */
@Entity('fund_ledger_entries')
export class FundLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({ type: 'varchar', length: 3 })
  direction: LedgerDirection;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ type: 'varchar', length: 20 })
  category: LedgerCategory;

  @Column({ name: 'source_type', type: 'varchar', length: 20 })
  sourceType: LedgerSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'source_code', type: 'varchar', length: 20 })
  sourceCode: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'reverses_id', type: 'uuid', nullable: true })
  reversesId: string | null;

  /** F-S5 BR-F5-10: a deposit offset's two lines move no money; no statement line matches them. */
  @Column({ type: 'boolean', default: false })
  internal: boolean;

  @Column({ type: 'varchar', length: 20, default: 'UNRECONCILED' })
  reconciliation: 'UNRECONCILED' | 'RECONCILED';

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
