import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, notFound } from '../../common/errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { fieldError } from '../../common/validation/field-errors';
import { type Capability, type Role, ROLE_LABEL, ROLES, roleCapabilities } from '../../domain/permissions';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { User } from '../users/entities/user.entity';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RoleDefinition } from './entities/role-definition.entity';

/** Short codes of the system role rows. */
export const SYSTEM_ROLE_CODE = {
  ADMIN: 'ADMIN',
  BQL: 'BQL',
  TECH_CONFIRMER: 'KT',
  TECH_CONSULTANT: 'TVKT',
  OWNERS_BOARD: 'BQT',
  ACCOUNTANT: 'KTOAN',
} as const satisfies Record<Role, string>;

export const CUSTOM_ROLE_PREFIX = 'VT';

export interface RoleView {
  id: string;
  code: string;
  name: string;
  baseRole: Role;
  capabilities: string[];
  isSystem: boolean;
  sourceRoleId: string | null;
  /**
   * Capabilities the base role gained after this custom role was last saved and that it does not hold:
   * "Có quyền mới chưa bật". Saving the role clears the list. Always empty for system roles.
   */
  newBaseCapabilities: string[];
  holderCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Base capabilities added after the custom role was last saved and not held by it (PD-07 Q5). */
const newBaseCapabilitiesOf = (role: RoleDefinition): string[] => {
  if (role.isSystem || !role.baseCapabilities) return [];
  const known = role.baseCapabilities;
  return roleCapabilities(role.baseRole).filter(
    (capability) => !known.includes(capability) && !role.capabilities.includes(capability),
  );
};

@Injectable()
export class RolesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
  ) {}

  /** System roles first, then custom roles by code. */
  async list(): Promise<RoleView[]> {
    const rows = await this.dataSource.getRepository(RoleDefinition).find();
    const counts = await this.holderCounts();
    return rows
      .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.code.localeCompare(b.code))
      .map((role) => this.toView(role, counts.get(role.id) ?? 0));
  }

  async create(actor: AuthenticatedUser, dto: CreateRoleDto): Promise<RoleView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RoleDefinition);
      const source = dto.sourceRoleId ? await repo.findOneBy({ id: dto.sourceRoleId }) : null;
      if (dto.sourceRoleId && !source) throw fieldError('sourceRoleId', 'Không tìm thấy vai trò nguồn.');
      const baseRole = source?.baseRole ?? dto.baseRole;
      if (!baseRole) throw fieldError('baseRole', 'Cần chọn vai trò gốc để xác định quyền ban đầu.');
      await this.assertNameFree(manager, dto.name);

      // A copied list may still name capabilities the base role has since lost (matrix v2); keep the valid part.
      const base = roleCapabilities(baseRole) as readonly string[];
      const copied = source?.capabilities.filter((capability) => base.includes(capability));
      const initial = dto.capabilities ?? copied ?? [...base];
      const role = await repo.save(
        repo.create({
          code: await this.codes.next(manager, CUSTOM_ROLE_PREFIX, 2),
          name: dto.name,
          baseRole,
          capabilities: narrowCapabilities(baseRole, initial),
          baseCapabilities: [...base],
          isSystem: false,
          sourceRoleId: source?.id ?? null,
        }),
      );
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.ACCOUNT,
        subjectId: role.id,
        buildingId: null,
        action: 'createRoleDef',
        actorId: actor.id,
        entityVersion: role.version,
        reason: source ? `Sao chép từ ${source.name}` : `Tạo từ vai trò gốc ${ROLE_LABEL[baseRole]}`,
      });
      return this.toView(role, 0);
    });
  }

  /** Holders' effective capabilities follow immediately (they are derived from the role on every request). */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateRoleDto): Promise<RoleView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RoleDefinition);
      const role = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!role) throw notFound('Không tìm thấy vai trò.');
      if (role.isSystem) {
        throw fieldError('id', 'Vai trò hệ thống không sửa được; hãy sao chép thành vai trò mới.');
      }
      assertVersion(role.version, dto.version);
      if (role.name.toLowerCase() !== dto.name.toLowerCase()) await this.assertNameFree(manager, dto.name);

      role.name = dto.name;
      role.capabilities = narrowCapabilities(role.baseRole, dto.capabilities);
      role.baseCapabilities = [...roleCapabilities(role.baseRole)];
      role.version += 1;
      const saved = await repo.save(role);
      const holders = await manager.getRepository(User).countBy({ roleDefId: role.id });
      // TODO(Đợt 2): re-evaluate open steps of holders whose permissions were narrowed ("Cần phân công lại").
      await this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.ACCOUNT,
        subjectId: role.id,
        buildingId: null,
        action: 'updateRoleDef',
        actorId: actor.id,
        entityVersion: saved.version,
        reason: `${holders} tài khoản được cập nhật quyền`,
      });
      return this.toView(saved, holders);
    });
  }

  /** Keeps one system row per Role in line with the code matrix. Runs at every boot. */
  async syncSystemRoles(manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(RoleDefinition);
    for (const role of ROLES) {
      const code = SYSTEM_ROLE_CODE[role];
      const capabilities = [...roleCapabilities(role)];
      const existing = await repo.findOneBy({ code });
      if (!existing) {
        await repo.insert(repo.create({ code, name: ROLE_LABEL[role], baseRole: role, capabilities, isSystem: true }));
      } else if (existing.capabilities.join('|') !== capabilities.join('|')) {
        await repo.update({ id: existing.id }, { capabilities, version: existing.version + 1 });
      }
    }
  }

  private async assertNameFree(manager: EntityManager, name: string): Promise<void> {
    const taken = await manager
      .getRepository(RoleDefinition)
      .createQueryBuilder('r')
      .where('lower(r.name) = lower(:name)', { name })
      .getExists();
    if (taken) throw fieldError('name', 'Tên vai trò đã tồn tại.');
  }

  private async holderCounts(): Promise<Map<string, number>> {
    const rows = await this.dataSource.query<Array<{ role_def_id: string; count: number }>>(
      'SELECT role_def_id, count(*)::int AS count FROM users WHERE role_def_id IS NOT NULL GROUP BY role_def_id',
    );
    return new Map(rows.map((row) => [row.role_def_id, row.count]));
  }

  private toView(role: RoleDefinition, holderCount: number): RoleView {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      baseRole: role.baseRole,
      capabilities: role.capabilities,
      isSystem: role.isSystem,
      sourceRoleId: role.sourceRoleId,
      newBaseCapabilities: newBaseCapabilitiesOf(role),
      holderCount,
      version: role.version,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}

/**
 * A custom role may only keep capabilities of its system role (never add one) and always keeps VIEW.
 * Throws a field error when a capability outside the base role is requested.
 */
export function narrowCapabilities(baseRole: Role, requested: readonly string[]): Capability[] {
  const allowed = roleCapabilities(baseRole);
  const outside = requested.filter((capability) => !allowed.includes(capability as Capability));
  if (outside.length > 0) {
    throw fieldError('capabilities', `Không thể cấp quyền ngoài vai trò gốc “${ROLE_LABEL[baseRole]}”.`);
  }
  const kept = allowed.filter((capability) => requested.includes(capability));
  return kept.includes('VIEW') ? kept : ['VIEW', ...kept];
}
