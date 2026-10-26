import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { TaskDueDays, WorkflowApprovalStep, WorkflowStageConfig } from '../../../domain/building-config';
import { Building } from '../../buildings/entities/building.entity';
import { Location } from '../../buildings/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import type { ProposalDraft } from '../proposal.types';

@Entity('repair_records')
@Check('CHK_repair_records_priority', `priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')`)
@Index('IDX_repair_records_building_created', ['buildingId', 'createdAt'])
@Index('IDX_repair_records_scope_updated', ['buildingId', 'updatedAt'])
@Index('IDX_repair_records_status', ['status'])
export class RepairRecord extends BaseEntity {
  @Index('UQ_repair_records_code', { unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @ManyToOne(() => Building, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'building_id', foreignKeyConstraintName: 'FK_repair_records_building' })
  building: Building;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id', foreignKeyConstraintName: 'FK_repair_records_location' })
  location: Location | null;

  @Column({ name: 'no_maintenance_item', type: 'boolean', default: false })
  noMaintenanceItem: boolean;

  @Column({ type: 'varchar', length: 120, default: '' })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  priority: string;

  @Column({ type: 'varchar', length: 40, default: 'DRAFT' })
  status: string;

  @Column({ name: 'manager_user_id', type: 'uuid' })
  managerUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'manager_user_id', foreignKeyConstraintName: 'FK_repair_records_manager' })
  manager: User;

  @Column({ name: 'confirmation_user_id', type: 'uuid', nullable: true })
  confirmationUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'confirmation_user_id', foreignKeyConstraintName: 'FK_repair_records_confirmation' })
  confirmationUser: User | null;

  @Column({ name: 'consultant_user_id', type: 'uuid', nullable: true })
  consultantUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consultant_user_id', foreignKeyConstraintName: 'FK_repair_records_consultant' })
  consultantUser: User | null;

  @Column({ name: 'board_user_id', type: 'uuid', nullable: true })
  boardUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'board_user_id', foreignKeyConstraintName: 'FK_repair_records_board' })
  boardUser: User | null;

  @Column({ name: 'approval_step_keys', type: 'text', array: true, default: () => `'{}'` })
  approvalStepKeys: string[];

  @Column({ name: 'workflow_approval_steps', type: 'jsonb', default: () => `'[]'` })
  workflowApprovalSteps: WorkflowApprovalStep[];

  @Column({ name: 'workflow_stage_approval_step_keys', type: 'jsonb', default: () => `'{}'` })
  workflowStageApprovalStepKeys: Partial<Record<WorkflowStageConfig['key'], string[]>>;

  @Column({ name: 'approval_assignee_user_ids', type: 'jsonb', default: () => `'{}'` })
  approvalAssigneeUserIds: Record<string, string>;

  @Column({ name: 'task_due_days', type: 'jsonb', default: () => `'{}'` })
  taskDueDays: TaskDueDays;

  /** Ordered ids of the files attached to the record; removing an id detaches it without deleting the file. */
  @Column({ name: 'attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  attachmentIds: string[];

  /** Proposal being prepared by the manager (S2); every field optional until submission. */
  @Column({ name: 'proposal_draft', type: 'jsonb', nullable: true })
  proposalDraft: ProposalDraft | null;

  /** Approval step the record waits on (custom steps share one status, so the key is kept). */
  @Column({ name: 'current_approval_step_key', type: 'varchar', length: 60, nullable: true })
  currentApprovalStepKey: string | null;

  @Column({ name: 'current_submission_id', type: 'uuid', nullable: true })
  currentSubmissionId: string | null;

  @Column({ name: 'approved_submission_id', type: 'uuid', nullable: true })
  approvedSubmissionId: string | null;

  /** Integer VND as a string (bigint column); set when the last approval step approves. */
  @Column({ name: 'approved_amount_vnd', type: 'bigint', nullable: true })
  approvedAmountVnd: string | null;

  @Column({ name: 'executing_contractor_name', type: 'varchar', length: 200, nullable: true })
  executingContractorName: string | null;

  /** Acceptance round in progress or last closed (S3). */
  @Column({ name: 'current_acceptance_id', type: 'uuid', nullable: true })
  currentAcceptanceId: string | null;

  /** Repair work saved by T15 and offered again by T16. */
  @Column({ name: 'repair_draft', type: 'jsonb', nullable: true })
  repairDraft: { note?: string; attachmentIds?: string[] } | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_repair_records_created_by' })
  creator: User;
}
