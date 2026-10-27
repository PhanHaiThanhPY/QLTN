import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** One item of the checklist template (SPEC MT-S2 BR-MT2-03). */
export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
  kind: 'CHECK' | 'MEASUREMENT';
  unit: string | null;
  min: number | null;
  max: number | null;
  photoRequired: boolean;
}

/** A maintenance plan of an item (SPEC MT-S2 BR-MT2-01, BR-MT2-04); its schedule lives in schedule versions. */
@Entity('maintenance_plans')
@Index('UQ_maintenance_plans_code', ['code'], { unique: true })
export class MaintenancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: PlanStatus;

  @Column({ name: 'manager_user_id', type: 'uuid' })
  managerUserId: string;

  @Column({ name: 'performer_user_id', type: 'uuid' })
  performerUserId: string;

  @Column({ name: 'reviewer_user_id', type: 'uuid' })
  reviewerUserId: string;

  @Column({ name: 'contractor_name', type: 'varchar', length: 200, nullable: true })
  contractorName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  checklist: ChecklistTemplateItem[];

  /** First day the generator may use (activation or resume day). */
  @Column({ name: 'active_since', type: 'date', nullable: true })
  activeSince: string | null;

  @Column({ name: 'paused_on', type: 'date', nullable: true })
  pausedOn: string | null;

  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  /** Optimistic lock, raised by the service on every write. */
  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
