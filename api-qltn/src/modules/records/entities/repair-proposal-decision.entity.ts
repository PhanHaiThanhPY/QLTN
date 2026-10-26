import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RepairProposalSubmission } from './repair-proposal-submission.entity';

export const DECISION_OUTCOMES = ['APPROVED', 'NEEDS_UPDATE', 'REJECTED'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** Decision of one approval step on one submission; append-only. */
@Entity('repair_proposal_decisions')
@Index('IDX_repair_proposal_decisions_submission', ['submissionId', 'createdAt'])
@Check('CHK_repair_proposal_decisions_outcome', `outcome IN ('APPROVED', 'NEEDS_UPDATE', 'REJECTED')`)
export class RepairProposalDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @ManyToOne(() => RepairProposalSubmission, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'submission_id', foreignKeyConstraintName: 'FK_repair_proposal_decisions_submission' })
  submission: RepairProposalSubmission;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'step_key', type: 'varchar', length: 60 })
  stepKey: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'FK_repair_proposal_decisions_actor' })
  actor: User;

  @Column({ type: 'varchar', length: 20 })
  outcome: DecisionOutcome;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason: string | null;

  @Column({ name: 'selected_contractor_index', type: 'integer', nullable: true })
  selectedContractorIndex: number | null;

  /** Board meeting minutes of a BQT decision (BR-S2-05). */
  @Column({ name: 'attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  attachmentIds: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
