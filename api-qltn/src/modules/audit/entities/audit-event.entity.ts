import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const SUBJECT_TYPE = {
  BUILDING: 'BUILDING',
  ACCOUNT: 'ACCOUNT',
  /** Custom role definitions (before AD-S1 they were written as ACCOUNT; migration 2026-10-26e). */
  ROLE: 'ROLE',
  /** Departments (before AD-S1 they were written as ACCOUNT; migration 2026-10-26e). */
  DEPARTMENT: 'DEPARTMENT',
  REPAIR_RECORD: 'REPAIR_RECORD',
  MAINTENANCE_ITEM: 'MAINTENANCE_ITEM',
  MAINTENANCE_PLAN: 'MAINTENANCE_PLAN',
  MAINTENANCE_OCCURRENCE: 'MAINTENANCE_OCCURRENCE',
  EXPLOITATION_PARTNER: 'EXPLOITATION_PARTNER',
  EXPLOITATION_PACKAGE: 'EXPLOITATION_PACKAGE',
  EXPLOITATION_BID: 'EXPLOITATION_BID',
  EXPLOITATION_SELECTION: 'EXPLOITATION_SELECTION',
  EXPLOITATION_ASSEMBLY: 'EXPLOITATION_ASSEMBLY',
  EXPLOITATION_CONTRACT: 'EXPLOITATION_CONTRACT',
} as const;
export type SubjectType = (typeof SUBJECT_TYPE)[keyof typeof SUBJECT_TYPE];

/** Append-only trail of every business change, written in the same transaction as the change. */
@Entity('audit_events')
@Index('IDX_audit_events_subject', ['subjectType', 'subjectId', 'createdAt'])
@Index('IDX_audit_events_building', ['buildingId', 'createdAt'])
// IDX_audit_events_created (created_at DESC, id DESC) is created by migration 2026-10-26e for the operation log.
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 40 })
  subjectType: SubjectType;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  /** NULL for account-level (global) changes. */
  @Column({ name: 'building_id', type: 'uuid', nullable: true })
  buildingId: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  /** NULL when the system acted. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'entity_version', type: 'integer', nullable: true })
  entityVersion: number | null;

  @Column({ name: 'from_status', type: 'varchar', length: 40, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 40, nullable: true })
  toStatus: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
