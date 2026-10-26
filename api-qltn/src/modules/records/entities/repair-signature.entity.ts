import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RepairRecord } from './repair-record.entity';

export const SIGNED_DOCUMENT_TYPES = ['PROPOSAL', 'BOARD_DECISION'] as const;
export type SignedDocumentType = (typeof SIGNED_DOCUMENT_TYPES)[number];

/** Quick hand-drawn signature (PNG only, not a digital signature) bound to one document (BR-C-03). */
@Entity('repair_signatures')
@Index('IDX_repair_signatures_document', ['documentType', 'documentId'])
@Check('CHK_repair_signatures_document_type', `document_type IN ('PROPOSAL', 'BOARD_DECISION')`)
export class RepairSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @ManyToOne(() => RepairRecord, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'record_id', foreignKeyConstraintName: 'FK_repair_signatures_record' })
  record: RepairRecord;

  @Column({ name: 'document_type', type: 'varchar', length: 30 })
  documentType: SignedDocumentType;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'signer_id', type: 'uuid' })
  signerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'signer_id', foreignKeyConstraintName: 'FK_repair_signatures_signer' })
  signer: User;

  @Column({ name: 'mime_type', type: 'varchar', length: 20 })
  mimeType: string;

  @Column({ type: 'bytea' })
  content: Buffer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
