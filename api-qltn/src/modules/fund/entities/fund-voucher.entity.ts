import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { FundKind } from './fund.entity';

/** F-S5 BR-F5-12 adds DEPOSIT_REFUND ("Hoàn cọc"), naming its contract. */
export const VOUCHER_CATEGORIES = ['SERVICE', 'TRANSFER', 'OTHER', 'DEPOSIT_REFUND'] as const;
export type VoucherCategory = (typeof VOUCHER_CATEGORIES)[number];
export const VOUCHER_STATUSES = [
  'DRAFT',
  'PENDING',
  'NEEDS_CHANGES',
  'APPROVED',
  'REJECTED',
  'PAID',
  'CANCELLED',
] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

/** BR-F3-12: cancelling a PAID voucher waits for BQT. */
export interface CancelRequest {
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

/** A payment voucher (PC-NNN, SPEC F-S3 BR-F3-12): approved by BQT; only once PAID is it a ledger line. */
@Entity('fund_vouchers')
export class FundVoucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 20 })
  category: VoucherCategory;

  @Column({ name: 'contract_id', type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ name: 'target_fund_kind', type: 'varchar', length: 20, nullable: true })
  targetFundKind: FundKind | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'payee_name', type: 'varchar', length: 200 })
  payeeName: string;

  @Column({ name: 'payee_account', type: 'varchar', length: 60, nullable: true })
  payeeAccount: string | null;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ name: 'request_attachment_id', type: 'uuid' })
  requestAttachmentId: string;

  @Column({ type: 'varchar', length: 15, default: 'DRAFT' })
  status: VoucherStatus;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'paid_on', type: 'date', nullable: true })
  paidOn: string | null;

  @Column({ name: 'proof_attachment_id', type: 'uuid', nullable: true })
  proofAttachmentId: string | null;

  @Column({ name: 'ledger_entry_id', type: 'uuid', nullable: true })
  ledgerEntryId: string | null;

  @Column({ name: 'cancel_request', type: 'jsonb', nullable: true })
  cancelRequest: CancelRequest | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

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
