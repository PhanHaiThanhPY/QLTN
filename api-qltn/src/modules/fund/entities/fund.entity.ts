import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FUND_KINDS = ['KHAI_THAC', 'BAO_TRI'] as const;
export type FundKind = (typeof FUND_KINDS)[number];

/** D-F3-5: an opening change waiting for BQT once the ledger has lines. */
export interface PendingOpening {
  openingDate: string;
  openingBalanceVnd: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

/** One fund per building and kind (SPEC F-S3 BR-F3-01), with its one account and opening balance (BR-F3-02). */
@Entity('funds')
export class Fund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: FundKind;

  @Column({ name: 'bank_name', type: 'varchar', length: 200, nullable: true })
  bankName: string | null;

  @Column({ name: 'account_no', type: 'varchar', length: 40, nullable: true })
  accountNo: string | null;

  @Column({ name: 'account_holder', type: 'varchar', length: 200, nullable: true })
  accountHolder: string | null;

  @Column({ name: 'opening_date', type: 'date', nullable: true })
  openingDate: string | null;

  @Column({ name: 'opening_balance_vnd', type: 'bigint', nullable: true })
  openingBalanceVnd: string | null;

  @Column({ name: 'pending_opening', type: 'jsonb', nullable: true })
  pendingOpening: PendingOpening | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
