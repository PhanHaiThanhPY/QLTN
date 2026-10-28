import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OfferCompleteness, PaymentKind, PaymentUnit } from './deposit-offer.entity';

export const DEPOSIT_SELECTION_STATUSES = ['PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export type DepositSelectionStatus = (typeof DEPOSIT_SELECTION_STATUSES)[number];
/** A result still in force for its invitation (BR-T1-09). */
export const LIVE_DEPOSIT_SELECTION_STATUSES = ['PENDING', 'NEEDS_CHANGES', 'APPROVED'] as const;

/** An offer as compared when the result was sent for approval (BR-T1-09, D1 p. 39); never edited. */
export interface OfferComparisonRow {
  rank: number;
  offerId: string;
  bankId: string;
  bankCode: string;
  bankName: string;
  shortName: string | null;
  rateMilli: number;
  dayBasis: number;
  interestVnd: string;
  paymentKind: PaymentKind;
  paymentEvery: number | null;
  paymentUnit: PaymentUnit | null;
  completeness: OfferCompleteness;
  missingNote: string | null;
  isLate: boolean;
  outside: boolean;
}

export interface DepositSelectionDecision {
  decision: 'SUBMIT' | 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  reason: string | null;
  by: string;
  at: string;
}

/** The bank selected for an invitation, or "Không chọn được ngân hàng" (SPEC T-S1 BR-T1-09..11): KQ-TGNN. */
@Entity('deposit_selections')
export class DepositSelection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'minutes_code', type: 'varchar', length: 20 })
  minutesCode: string;

  @Column({ name: 'invitation_id', type: 'uuid' })
  invitationId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 10 })
  kind: 'BANK' | 'NONE';

  @Column({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId: string | null;

  @Column({ name: 'bank_id', type: 'uuid', nullable: true })
  bankId: string | null;

  @Column({ name: 'minutes_attachment_id', type: 'uuid' })
  minutesAttachmentId: string;

  @Column({ type: 'text' })
  basis: string;

  @Column({ name: 'not_highest_reason', type: 'text', nullable: true })
  notHighestReason: string | null;

  @Column({ name: 'late_reason', type: 'text', nullable: true })
  lateReason: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  comparison: OfferComparisonRow[];

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: DepositSelectionStatus;

  @Column({ name: 'replaces_id', type: 'uuid', nullable: true })
  replacesId: string | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  decisions: DepositSelectionDecision[];

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
