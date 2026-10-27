import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { LedgerDirection } from '../../../domain/fund-ledger';

export type StatementLineStatus = 'UNMATCHED' | 'MATCHED' | 'RECORDED';

/** One bank transaction (GD-NNN per account, SPEC F-S4 BR-F4-04); never edited. */
@Entity('bank_statement_lines')
export class BankStatementLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'import_id', type: 'uuid' })
  importId: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'txn_date', type: 'date' })
  txnDate: string;

  @Column({ type: 'varchar', length: 3 })
  direction: LedgerDirection;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ name: 'dedupe_key', type: 'text' })
  dedupeKey: string;

  @Column({ name: 'possible_duplicate', type: 'boolean', default: false })
  possibleDuplicate: boolean;

  @Column({ type: 'varchar', length: 10, default: 'UNMATCHED' })
  status: StatementLineStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
