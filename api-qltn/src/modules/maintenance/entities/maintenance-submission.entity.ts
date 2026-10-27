import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { WorkEntry } from '../../../domain/maintenance-execution';

/** One submission of an occurrence and its review decision (SPEC MT-S3 BR-MT3-05, BR-MT3-06). Never edited. */
@Entity('maintenance_submissions')
@Index('UQ_maintenance_submissions_round', ['occurrenceId', 'round'], { unique: true })
export class MaintenanceSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'occurrence_id', type: 'uuid' })
  occurrenceId: string;

  @Column({ type: 'integer' })
  round: number;

  @Column({ type: 'jsonb' })
  entries: WorkEntry[];

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'contractor_name', type: 'varchar', length: 200, nullable: true })
  contractorName: string | null;

  @Column({ name: 'actual_worker', type: 'varchar', length: 120, nullable: true })
  actualWorker: string | null;

  @Column({ name: 'attachment_ids', type: 'jsonb', default: () => "'[]'" })
  attachmentIds: string[];

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'review_due_at', type: 'timestamptz' })
  reviewDueAt: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  decision: 'REWORK' | 'CONFIRMED' | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;

  @Column({ name: 'rework_items', type: 'jsonb', default: () => "'{}'" })
  reworkItems: Record<string, string>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  resolutions: Record<string, string>;

  @Column({ name: 'condition_after', type: 'varchar', length: 20, nullable: true })
  conditionAfter: string | null;

  @Column({ name: 'condition_note', type: 'text', nullable: true })
  conditionNote: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
