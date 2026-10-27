import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface TaxAdjustment {
  fromVnd: string;
  toVnd: string;
  reason: string;
  by: string;
  at: string;
}

/** A month's tax (TH-NNN) as the accounting file says; the system never applies a rate (SPEC F-S3 BR-F3-10). */
@Entity('fund_tax_obligations')
export class FundTaxObligation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'char', length: 7 })
  month: string;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  adjustments: TaxAdjustment[];

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
