import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const ACCEPTANCE_OUTCOMES = ['PENDING', 'PASSED', 'FAILED'] as const;
export type AcceptanceOutcome = (typeof ACCEPTANCE_OUTCOMES)[number];

/** One acceptance round = one set of minutes (D5-NT, SPEC §4.3); locked once every member decided or one failed. */
@Entity('repair_acceptances')
@Index('UQ_repair_acceptances_round', ['recordId', 'roundNo'], { unique: true })
@Check('CHK_repair_acceptances_outcome', `outcome IN ('PENDING', 'PASSED', 'FAILED')`)
export class RepairAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'round_no', type: 'integer' })
  roundNo: number;

  @Column({ name: 'completed_date', type: 'date' })
  completedDate: string;

  @Column({ name: 'inspected_at', type: 'timestamptz' })
  inspectedAt: Date;

  @Column({ name: 'inspection_location', type: 'varchar', length: 200 })
  inspectionLocation: string;

  @Column({ type: 'varchar', length: 2000 })
  content: string;

  @Column({ name: 'other_members', type: 'varchar', length: 1000, nullable: true })
  otherMembers: string | null;

  @Column({ name: 'photo_attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  photoAttachmentIds: string[];

  /** ACCEPTANCE steps of the snapshot when the round was created. */
  @Column({ name: 'member_step_keys', type: 'text', array: true })
  memberStepKeys: string[];

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  outcome: AcceptanceOutcome;

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
