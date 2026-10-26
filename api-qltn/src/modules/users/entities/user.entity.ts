import { Check, Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { Role } from '../../../domain/permissions';
import { Building } from '../../buildings/entities/building.entity';
import { Location } from '../../buildings/entities/location.entity';
import { RoleDefinition } from '../../roles/entities/role-definition.entity';
import { Department } from '../../organization/entities/department.entity';

@Entity('users')
@Index('UQ_users_code', ['code'], { unique: true })
@Index('UQ_users_username', ['username'], { unique: true })
@Check('CHK_users_role', `role IN ('ADMIN', 'BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD', 'ACCOUNTANT')`)
@Check('CHK_users_username_lower', `username = lower(username)`)
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  code: string;

  /** Login name, always lower-case. */
  @Column({ type: 'varchar', length: 50 })
  username: string;

  /** bcrypt hash; NULL = the account cannot log in with a password. Never selected by default. */
  @Column({ name: 'password_hash', type: 'varchar', length: 100, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 30 })
  role: Role;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id', foreignKeyConstraintName: 'FK_users_department' })
  department: Department | null;

  @Column({ name: 'job_title', type: 'varchar', length: 200, nullable: true })
  jobTitle: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Custom role narrowing the system role; NULL = the system role's full capability set. */
  @Column({ name: 'role_def_id', type: 'uuid', nullable: true })
  roleDefId: string | null;

  @ManyToOne(() => RoleDefinition, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_def_id', foreignKeyConstraintName: 'FK_users_role_def' })
  roleDef: RoleDefinition | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ManyToMany(() => Building)
  @JoinTable({
    name: 'user_buildings',
    joinColumn: { name: 'user_id', foreignKeyConstraintName: 'FK_user_buildings_user' },
    inverseJoinColumn: { name: 'building_id', foreignKeyConstraintName: 'FK_user_buildings_building' },
  })
  buildings: Building[];

  /** Optional location scope inside the assigned buildings (empty = anywhere in them). */
  @ManyToMany(() => Location)
  @JoinTable({
    name: 'user_locations',
    joinColumn: { name: 'user_id', foreignKeyConstraintName: 'FK_user_locations_user' },
    inverseJoinColumn: { name: 'location_id', foreignKeyConstraintName: 'FK_user_locations_location' },
  })
  locations: Location[];
}
