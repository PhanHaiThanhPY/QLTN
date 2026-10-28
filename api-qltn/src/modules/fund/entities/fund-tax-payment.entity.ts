import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RecordedStatus } from './recorded-status';

/** A tax payment slip (GNT-NNN, FG-04) against an obligation; one "Chi thuế" ledger line (SPEC F-S3 BR-F3-11). */
@Entity('fund_tax_payments')
export class FundTaxPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'obligation_id', type: 'uuid' })
  obligationId: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'paid_on', type: 'date' })
  paidOn: string;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId: string;

  @Column({ type: 'varchar', length: 10, default: 'RECORDED' })
  status: RecordedStatus;

  @Column({ name: 'ledger_entry_id', type: 'uuid' })
  ledgerEntryId: string;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
