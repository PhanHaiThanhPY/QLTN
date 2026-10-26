import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One progress update (T11); append-only. */
@Entity('repair_construction_updates')
@Index('IDX_repair_construction_updates_record', ['recordId', 'createdAt'])
export class RepairConstructionUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'progress_percent', type: 'integer' })
  progressPercent: number;

  @Column({ type: 'varchar', length: 1000 })
  note: string;

  @Column({ name: 'attachment_ids', type: 'uuid', array: true, default: () => `'{}'` })
  attachmentIds: string[];

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
