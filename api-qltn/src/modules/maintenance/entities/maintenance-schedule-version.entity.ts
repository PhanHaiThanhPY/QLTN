import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ScheduleUnit } from '../../../domain/maintenance-schedule';

/** One schedule of a plan from its effective date (SPEC MT-S2 BR-MT2-05); a later change may supersede it. */
@Entity('maintenance_schedule_versions')
@Index('IDX_maintenance_schedule_versions_plan', ['planId', 'effectiveFrom'])
export class MaintenanceScheduleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ type: 'varchar', length: 10 })
  unit: ScheduleUnit;

  @Column({ type: 'integer' })
  every: number;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'anchor_date', type: 'date' })
  anchorDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'superseded_by', type: 'uuid', nullable: true })
  supersededBy: string | null;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
