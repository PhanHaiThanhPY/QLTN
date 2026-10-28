import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const INVITATION_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'SELECTED', 'NO_RESULT', 'CANCELLED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** A rate invitation on one maintenance fund (SPEC T-S1 BR-T1-03, BR-T1-04): MC-NNN. */
@Entity('deposit_invitations')
export class DepositInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'amount_vnd', type: 'bigint' })
  amountVnd: string;

  @Column({ name: 'term_days', type: 'integer' })
  termDays: number;

  @Column({ name: 'deadline_at', type: 'timestamptz', nullable: true })
  deadlineAt: Date | null;

  @Column({ name: 'expected_deposit_on', type: 'date', nullable: true })
  expectedDepositOn: string | null;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  @Column({ name: 'letter_attachment_id', type: 'uuid', nullable: true })
  letterAttachmentId: string | null;

  @Column({ name: 'invitee_ids', type: 'jsonb', default: () => "'[]'" })
  inviteeIds: string[];

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: InvitationStatus;

  @Column({ name: 'sent_on', type: 'date', nullable: true })
  sentOn: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'close_kind', type: 'varchar', length: 10, nullable: true })
  closeKind: 'DEADLINE' | 'EARLY' | null;

  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
