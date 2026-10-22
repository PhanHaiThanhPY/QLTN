import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { Role } from '../../../domain/permissions';

/** System roles (one per Role, synced from code at boot) and custom roles that narrow a system role. */
@Entity('role_definitions')
@Index('UQ_role_definitions_code', ['code'], { unique: true })
@Check(
  'CHK_role_definitions_base_role',
  `base_role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD')`,
)
export class RoleDefinition extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  code: string;

  /** Unique case-insensitively (index UQ_role_definitions_name on lower(name), declared in SQL). */
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'base_role', type: 'varchar', length: 30 })
  baseRole: Role;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  capabilities: string[];

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'source_role_id', type: 'uuid', nullable: true })
  sourceRoleId: string | null;

  @ManyToOne(() => RoleDefinition, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_role_id', foreignKeyConstraintName: 'FK_role_definitions_source' })
  sourceRole: RoleDefinition | null;
}
