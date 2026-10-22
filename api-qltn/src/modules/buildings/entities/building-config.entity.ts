import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type {
  AssignmentRule,
  TaskDueDays,
  WorkflowApprovalStep,
  WorkflowStageConfig,
} from '../../../domain/building-config';
import { Building } from './building.entity';

/** numeric(4,2) comes back from pg as a string. */
const decimalToNumber = { to: (value: number) => value, from: (value: string) => Number(value) };

/** One configuration per building. Records snapshot the values that applied when they were created. */
@Entity('building_configs')
@Check('CHK_building_configs_emergency_limit', 'emergency_limit_vnd > 0')
export class BuildingConfig {
  @PrimaryColumn({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @OneToOne(() => Building, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id', foreignKeyConstraintName: 'FK_building_configs_building' })
  building: Building;

  @Column({ name: 'template_key', type: 'varchar', length: 30, nullable: true })
  templateKey: string | null;

  @Column({ name: 'workflow_name', type: 'varchar', length: 120, nullable: true })
  workflowName: string | null;

  @Column({ name: 'workflow_description', type: 'varchar', length: 500, nullable: true })
  workflowDescription: string | null;

  @Column({ name: 'task_due_days', type: 'jsonb' })
  taskDueDays: TaskDueDays;

  @Column({ name: 'approval_step_keys', type: 'text', array: true })
  approvalStepKeys: string[];

  @Column({ name: 'workflow_approval_steps', type: 'jsonb' })
  workflowApprovalSteps: WorkflowApprovalStep[];

  @Column({ name: 'workflow_stages', type: 'jsonb' })
  workflowStages: WorkflowStageConfig[];

  @Column({ name: 'assignment_rules', type: 'jsonb', default: () => `'[]'` })
  assignmentRules: AssignmentRule[];

  /** VND as a decimal string (bigint column). */
  @Column({ name: 'emergency_limit_vnd', type: 'bigint' })
  emergencyLimitVnd: string;

  @Column({ name: 'emergency_doc_hours', type: 'integer' })
  emergencyDocHours: number;

  @Column({ name: 'recent_repair_days', type: 'integer' })
  recentRepairDays: number;

  @Column({ name: 'repeat_min_records', type: 'integer' })
  repeatMinRecords: number;

  @Column({ name: 'price_ratio', type: 'numeric', precision: 4, scale: 2, transformer: decimalToNumber })
  priceRatio: number;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;
}
