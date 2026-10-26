import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** In-app notification for one recipient (minimum of SPEC B03–B09 v2 BR-S3-01a; the full module is B14). */
@Entity('notifications')
@Index('IDX_notifications_recipient', ['recipientId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @Column({ type: 'varchar', length: 40 })
  kind: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 40 })
  subjectType: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'building_id', type: 'uuid', nullable: true })
  buildingId: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
