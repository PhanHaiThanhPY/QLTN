import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A period that fell while the plan was paused ("Bỏ qua do tạm dừng", SPEC MT-S2 BR-MT2-04). */
@Entity('maintenance_skipped_periods')
@Index('UQ_maintenance_skipped_periods', ['planId', 'periodDate'], { unique: true })
export class MaintenanceSkippedPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'period_date', type: 'date' })
  periodDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
