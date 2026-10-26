import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RepairRecord } from './repair-record.entity';

export const CONFIRMATION_OUTCOMES = ['CONFIRMED', 'NEEDS_UPDATE', 'NO_REPAIR'] as const;
export type ConfirmationOutcome = (typeof CONFIRMATION_OUTCOMES)[number];

/**
 * One conclusion of the technical confirmer on a `PENDING_CONFIRMATION` record (same shape as the demo's
 * `repairConfirmations`). Rows are append-only: a record sent back for supplements keeps every earlier one.
 */
@Entity('repair_confirmations')
@Index('IDX_repair_confirmations_record', ['recordId', 'createdAt'])
@Check('CHK_repair_confirmations_outcome', `outcome IN ('CONFIRMED', 'NEEDS_UPDATE', 'NO_REPAIR')`)
export class RepairConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @ManyToOne(() => RepairRecord, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'record_id', foreignKeyConstraintName: 'FK_repair_confirmations_record' })
  record: RepairRecord;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'FK_repair_confirmations_actor' })
  actor: User;

  @Column({ type: 'varchar', length: 20 })
  outcome: ConfirmationOutcome;

  @Column({ type: 'varchar', length: 1000 })
  note: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
