import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Construction of a repair record (T10–T12): plan, progress and completion date. One per record. */
@Entity('repair_constructions')
@Index('UQ_repair_constructions_record', ['recordId'], { unique: true })
@Check('CHK_repair_constructions_progress', 'progress_percent BETWEEN 0 AND 100')
export class RepairConstruction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'planned_end_date', type: 'date' })
  plannedEndDate: string;

  @Column({ name: 'plan_note', type: 'varchar', length: 1000 })
  planNote: string;

  @Column({ name: 'progress_percent', type: 'integer', default: 0 })
  progressPercent: number;

  @Column({ name: 'completed_date', type: 'date', nullable: true })
  completedDate: string | null;

  @Column({ name: 'started_by', type: 'uuid' })
  startedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
