import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One import of a bank statement for a fund's account (SPEC F-S4 BR-F4-01); it closes or it is refused. */
@Entity('bank_statement_imports')
export class BankStatementImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'period_from', type: 'date' })
  periodFrom: string;

  @Column({ name: 'period_to', type: 'date' })
  periodTo: string;

  @Column({ name: 'opening_balance_vnd', type: 'bigint' })
  openingBalanceVnd: string;

  @Column({ name: 'closing_balance_vnd', type: 'bigint' })
  closingBalanceVnd: string;

  @Column({ type: 'varchar', length: 10 })
  source: 'FILE' | 'MANUAL';

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId: string | null;

  @Column({ name: 'new_count', type: 'integer' })
  newCount: number;

  @Column({ name: 'duplicate_count', type: 'integer' })
  duplicateCount: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;

  @Column({ name: 'delete_reason', type: 'text', nullable: true })
  deleteReason: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
