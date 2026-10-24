import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One stored file, linked to a business subject by (`subjectType`, `subjectId`) so later
 * steps and maintenance can reuse the same table. In T2 only repair-record site photos exist.
 */
@Entity('attachments')
@Index('IDX_attachments_subject', ['subjectType', 'subjectId', 'createdAt'])
@Index('IDX_attachments_building', ['buildingId', 'createdAt'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 40 })
  subjectType: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @ManyToOne(() => Building, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'building_id', foreignKeyConstraintName: 'FK_attachments_building' })
  building: Building;

  @Column({ type: 'varchar', length: 40 })
  purpose: string;

  @Column({ name: 'file_name', type: 'varchar', length: 200 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  /** Storage key under `STORAGE_DIR`; never the uploaded file name. */
  @Column({ name: 'content_ref', type: 'varchar', length: 200 })
  contentRef: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by', foreignKeyConstraintName: 'FK_attachments_uploaded_by' })
  uploader: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
