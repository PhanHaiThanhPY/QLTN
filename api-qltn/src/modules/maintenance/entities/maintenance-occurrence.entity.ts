import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ChecklistTemplateItem } from './maintenance-plan.entity';

/** A maintenance visit (SPEC MT-S2 BR-MT2-06..08). MT-S2 only schedules and cancels; MT-S3 runs it. */
@Entity('maintenance_occurrences')
@Index('UQ_maintenance_occurrences_code', ['code'], { unique: true })
@Index('IDX_maintenance_occurrences_plan_date', ['planId', 'scheduledDate'])
export class MaintenanceOccurrence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: string;

  /** The period's own date ("ngày gốc"); null for a make-up occurrence. */
  @Column({ name: 'period_date', type: 'date', nullable: true })
  periodDate: string | null;

  /** Dedupe key: the period date while the occurrence holds its period, null once the period is released. */
  @Column({ name: 'period_key', type: 'date', nullable: true })
  periodKey: string | null;

  @Column({ type: 'varchar', length: 30, default: 'SCHEDULED' })
  status: string;

  @Column({ name: 'is_makeup', type: 'boolean', default: false })
  isMakeup: boolean;

  /** "Lịch đã đổi": waits for "Giữ lượt này" or "Hủy" after a schedule change. */
  @Column({ name: 'schedule_changed', type: 'boolean', default: false })
  scheduleChanged: boolean;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'performer_user_id', type: 'uuid' })
  performerUserId: string;

  @Column({ name: 'reviewer_user_id', type: 'uuid' })
  reviewerUserId: string;

  @Column({ name: 'contractor_name', type: 'varchar', length: 200, nullable: true })
  contractorName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  checklist: ChecklistTemplateItem[];

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
