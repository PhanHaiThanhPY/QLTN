import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { SubmissionContent } from '../proposal.types';
import { RepairRecord } from './repair-record.entity';

/** One immutable proposal submission (SPEC B03–B09 v2 BR-S2-02); never updated after insert. */
@Entity('repair_proposal_submissions')
@Index('UQ_repair_proposal_submissions_attempt', ['recordId', 'attemptNo'], { unique: true })
export class RepairProposalSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @ManyToOne(() => RepairRecord, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'record_id', foreignKeyConstraintName: 'FK_repair_proposal_submissions_record' })
  record: RepairRecord;

  @Column({ name: 'attempt_no', type: 'integer' })
  attemptNo: number;

  @Column({ type: 'jsonb' })
  content: SubmissionContent;

  /** Total of the proposed contractor, integer VND as a string. */
  @Column({ name: 'proposed_amount_vnd', type: 'bigint' })
  proposedAmountVnd: string;

  @Column({ name: 'attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  attachmentIds: string[];

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'submitted_by', foreignKeyConstraintName: 'FK_repair_proposal_submissions_submitter' })
  submitter: User;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;
}
