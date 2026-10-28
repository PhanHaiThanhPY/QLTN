import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PaymentKind = 'END' | 'PERIODIC';
export type PaymentUnit = 'MONTH' | 'DAY';
export type OfferCompleteness = 'COMPLETE' | 'INCOMPLETE';

/** A bank's offer on an invitation (SPEC T-S1 BR-T1-06, BR-T1-07): the rate in thousandths of a percent. */
@Entity('deposit_offers')
export class DepositOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invitation_id', type: 'uuid' })
  invitationId: string;

  @Column({ name: 'bank_id', type: 'uuid' })
  bankId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'rate_milli', type: 'integer' })
  rateMilli: number;

  @Column({ name: 'day_basis', type: 'integer' })
  dayBasis: 360 | 365;

  @Column({ name: 'payment_kind', type: 'varchar', length: 10 })
  paymentKind: PaymentKind;

  @Column({ name: 'payment_every', type: 'integer', nullable: true })
  paymentEvery: number | null;

  @Column({ name: 'payment_unit', type: 'varchar', length: 10, nullable: true })
  paymentUnit: PaymentUnit | null;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  @Column({ name: 'attachment_id', type: 'uuid' })
  attachmentId: string;

  @Column({ type: 'varchar', length: 12 })
  completeness: OfferCompleteness;

  @Column({ name: 'missing_note', type: 'text', nullable: true })
  missingNote: string | null;

  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate: boolean;

  @Column({ type: 'boolean', default: false })
  outside: boolean;

  @Column({ name: 'outside_reason', type: 'text', nullable: true })
  outsideReason: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
