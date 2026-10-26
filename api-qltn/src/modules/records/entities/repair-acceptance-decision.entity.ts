import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AcceptanceDecisionOutcome = 'PASSED' | 'FAILED';

/** Decision of one member step in one round; unique per step (`step_already_decided`), signed (BR-S3-03). */
@Entity('repair_acceptance_decisions')
@Index('UQ_repair_acceptance_decisions_step', ['acceptanceId', 'stepKey'], { unique: true })
@Check('CHK_repair_acceptance_decisions_outcome', `outcome IN ('PASSED', 'FAILED')`)
export class RepairAcceptanceDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'acceptance_id', type: 'uuid' })
  acceptanceId: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'step_key', type: 'varchar', length: 60 })
  stepKey: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 20 })
  outcome: AcceptanceDecisionOutcome;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  @Column({ name: 'attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  attachmentIds: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
