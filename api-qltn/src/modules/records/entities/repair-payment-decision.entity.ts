import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PaymentDecisionOutcome = 'APPROVED' | 'NEEDS_UPDATE';

/** Decision of one PAYMENT step on one revision of an instalment; append-only. */
@Entity('repair_payment_decisions')
@Index('IDX_repair_payment_decisions_payment', ['paymentId', 'createdAt'])
@Check('CHK_repair_payment_decisions_outcome', `outcome IN ('APPROVED', 'NEEDS_UPDATE')`)
export class RepairPaymentDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'revision_no', type: 'integer' })
  revisionNo: number;

  @Column({ name: 'step_key', type: 'varchar', length: 60 })
  stepKey: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 20 })
  outcome: PaymentDecisionOutcome;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
