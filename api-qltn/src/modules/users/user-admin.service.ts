import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, notFound } from '../../common/errors';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated } from '../../common/utils/pagination';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { ROLE_LABEL } from '../../domain/permissions';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { hashPassword } from '../auth/password';
import { Building } from '../buildings/entities/building.entity';
import { Location } from '../buildings/entities/location.entity';
import { Department } from '../organization/entities/department.entity';
import { RoleDefinition } from '../roles/entities/role-definition.entity';
import type { CreateUserDto, ListUsersQueryDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { toUserProfile, USER_PROFILE_RELATIONS, type UserProfile } from './users.service';

interface ResolvedFields {
  role: RoleDefinition;
  buildings: Building[];
  locations: Location[];
  department: Department | null;
}

/** Account administration (ACCOUNT_MANAGE). Rules mirror web/src/services/handlers/account-handlers.ts. */
@Injectable()
export class UserAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Accounts sharing at least one building with the viewer. */
  async list(viewer: AuthenticatedUser, query: ListUsersQueryDto): Promise<PaginatedResult<UserProfile>> {
    const window = pageWindow(query);
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .where('EXISTS (SELECT 1 FROM user_buildings ub WHERE ub.user_id = u.id AND ub.building_id IN (:...scope))', {
        scope: viewer.buildingIds.length > 0 ? viewer.buildingIds : ['00000000-0000-0000-0000-000000000000'],
      });
    if (query.q) {
      const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w.where('u.code ILIKE :like', { like }).orWhere('u.full_name ILIKE :like').orWhere('u.email ILIKE :like'),
        ),
      );
    }
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.departmentId) qb.andWhere('u.department_id = :departmentId', { departmentId: query.departmentId });
    if (query.active !== undefined) qb.andWhere('u.is_active = :active', { active: query.active });
    if (query.buildingId) {
      qb.andWhere('EXISTS (SELECT 1 FROM user_buildings ub2 WHERE ub2.user_id = u.id AND ub2.building_id = :b)', {
        b: query.buildingId,
      });
    }
    const [page, total] = await qb.orderBy('u.code', 'ASC').skip(window.skip).take(window.limit).getManyAndCount();
    const users = page.length
      ? await this.dataSource.getRepository(User).find({
          where: { id: In(page.map((u) => u.id)) },
          relations: USER_PROFILE_RELATIONS,
          order: { code: 'ASC' },
        })
      : [];
    return toPaginated(users.map(toUserProfile), total, window);
  }

  async get(viewer: AuthenticatedUser, id: string): Promise<UserProfile> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id }, relations: USER_PROFILE_RELATIONS });
    if (!user || !user.buildings.some((b) => viewer.buildingIds.includes(b.id))) {
      throw notFound('Không tìm thấy tài khoản.');
    }
    return toUserProfile(user);
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserProfile> {
    const passwordHash = await hashPassword(dto.password);
    const id = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const username = dto.username ?? dto.code.toLowerCase();
      const errors = new FieldErrors();
      errors.when(await repo.existsBy({ code: dto.code }), 'code', 'Mã tài khoản đã tồn tại.');
      errors.merge((await this.uniquenessErrors(manager, { username, email: dto.email })).list);
      errors.when(!dto.departmentId, 'departmentId', 'Cần chọn bộ phận.');
      errors.throwIfAny();

      const fields = await this.resolveFields(manager, actor, dto, []);
      const user = await repo.save(
        repo.create({
          code: dto.code,
          username,
          passwordHash,
          fullName: dto.fullName,
          role: fields.role.baseRole,
          roleDefId: fields.role.isSystem ? null : fields.role.id,
          departmentId: fields.department?.id ?? null,
          jobTitle: dto.jobTitle ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          isActive: true,
          buildings: fields.buildings,
          locations: fields.locations,
        }),
      );
      await this.recordAudit(manager, actor, user, 'createUser', `${user.code} – ${fields.role.name}`);
      return user.id;
    });
    // Every building of a new account is inside the creator's scope, so the creator can read it back.
    return this.get(actor, id);
  }

  /**
   * The system role cannot change (only custom roles of the same system role). Buildings outside the
   * administrator's scope that the account already has are kept as they are.
   */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto): Promise<UserProfile> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw notFound('Không tìm thấy tài khoản.');
      const current = await repo.findOneOrFail({ where: { id }, relations: USER_PROFILE_RELATIONS });
      if (!current.buildings.some((b) => actor.buildingIds.includes(b.id))) throw notFound('Không tìm thấy tài khoản.');
      assertVersion(user.version, dto.version);

      const keptOutside = current.buildings.map((b) => b.id).filter((bid) => !actor.buildingIds.includes(bid));
      const fields = await this.resolveFields(manager, actor, dto, keptOutside);
      const active = dto.active ?? current.isActive;
      const errors = new FieldErrors();
      errors.merge((await this.uniquenessErrors(manager, { username: dto.username, email: dto.email }, id)).list);
      errors.when(
        fields.role.baseRole !== current.role,
        'roleDefId',
        `Chỉ đổi sang vai trò cùng gốc “${ROLE_LABEL[current.role]}”; muốn đổi vai trò gốc hãy tạo tài khoản mới.`,
      );
      errors.when(!active && current.id === actor.id, 'active', 'Không thể tự ngừng hoạt động tài khoản đang dùng.');
      errors.throwIfAny();

      current.fullName = dto.fullName;
      if (dto.username !== undefined) current.username = dto.username;
      current.roleDefId = fields.role.isSystem ? null : fields.role.id;
      current.roleDef = fields.role;
      current.department = fields.department ?? current.department;
      current.departmentId = fields.department?.id ?? current.departmentId;
      if (dto.jobTitle !== undefined) current.jobTitle = dto.jobTitle;
      if (dto.email !== undefined) current.email = dto.email;
      if (dto.phone !== undefined) current.phone = dto.phone;
      current.isActive = active;
      current.buildings = fields.buildings;
      current.locations = fields.locations;
      current.version += 1;
      const saved = await repo.save(current);
      // TODO(Đợt 2): when deactivated or narrowed, move open steps the account can no longer do to "Cần phân công lại".
      if (!active) await this.revokeSessions(manager, saved.id);
      await this.recordAudit(
        manager,
        actor,
        saved,
        active ? 'updateUser' : 'deactivateUser',
        `${saved.code} – ${fields.role.name}`,
      );
    });
    return this.get(actor, id);
  }

  /** Sets a new password and signs the account out everywhere. */
  async resetPassword(actor: AuthenticatedUser, id: string, dto: ResetPasswordDto): Promise<{ reset: true }> {
    const passwordHash = await hashPassword(dto.password);
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({ where: { id }, relations: { buildings: true } });
      if (!user || !user.buildings.some((b) => actor.buildingIds.includes(b.id))) {
        throw notFound('Không tìm thấy tài khoản.');
      }
      await manager.getRepository(User).update({ id }, { passwordHash });
      await this.revokeSessions(manager, id);
      await this.recordAudit(manager, actor, user, 'resetPassword', user.code);
    });
    return { reset: true };
  }

  /**
   * Login matches `username` after lower-casing the input and e-mail via `lower(email)`
   * (`UsersService.findForLogin`), so duplicates are detected the same way. `excludeId` keeps an
   * account from colliding with its own row when it is saved without changing those fields.
   */
  private async uniquenessErrors(
    manager: EntityManager,
    input: { username?: string | null; email?: string | null },
    excludeId?: string,
  ): Promise<FieldErrors> {
    const repo = manager.getRepository(User);
    const errors = new FieldErrors();
    if (input.username) {
      const query = repo
        .createQueryBuilder('u')
        .where('lower(u.username) = :username', { username: input.username.toLowerCase() });
      if (excludeId) query.andWhere('u.id <> :excludeId', { excludeId });
      errors.when(await query.getExists(), 'username', 'Tên đăng nhập đã tồn tại.');
    }
    if (input.email) {
      const query = repo
        .createQueryBuilder('u')
        .where('lower(u.email) = :email', { email: input.email.toLowerCase() });
      if (excludeId) query.andWhere('u.id <> :excludeId', { excludeId });
      errors.when(await query.getExists(), 'email', 'Email đã được dùng.');
    }
    return errors;
  }

  private async resolveFields(
    manager: EntityManager,
    actor: AuthenticatedUser,
    dto: CreateUserDto | UpdateUserDto,
    keptOutside: readonly string[],
  ): Promise<ResolvedFields> {
    const picked = dto.buildingIds.filter((bid) => !keptOutside.includes(bid));
    const buildingIds = [...new Set([...keptOutside, ...picked])];
    const locationIds = dto.locationIds ?? [];
    const [role, buildings, locations, department] = await Promise.all([
      manager.getRepository(RoleDefinition).findOneBy({ id: dto.roleDefId }),
      buildingIds.length ? manager.getRepository(Building).findBy({ id: In(buildingIds) }) : Promise.resolve([]),
      locationIds.length ? manager.getRepository(Location).findBy({ id: In(locationIds) }) : Promise.resolve([]),
      dto.departmentId
        ? manager.getRepository(Department).findOne({ where: { id: dto.departmentId }, relations: { buildings: true } })
        : Promise.resolve(null),
    ]);

    const errors = new FieldErrors();
    errors.when(!role, 'roleDefId', 'Cần chọn vai trò.');
    errors.when(buildingIds.length === 0, 'buildingIds', 'Chọn ít nhất một tòa nhà.');
    errors.when(buildings.length !== buildingIds.length, 'buildingIds', 'Tòa nhà được chọn không tồn tại.');
    errors.when(
      picked.some((bid) => !actor.buildingIds.includes(bid)),
      'buildingIds',
      'Chỉ gán tòa trong phạm vi của bạn.',
    );
    errors.when(Boolean(dto.departmentId) && !department, 'departmentId', 'Bộ phận không tồn tại.');
    const departmentBuildings = department?.buildings.map((b) => b.id) ?? [];
    errors.when(
      departmentBuildings.length > 0 && !buildingIds.every((bid) => departmentBuildings.includes(bid)),
      'departmentId',
      'Bộ phận không phụ trách toàn bộ tòa nhà đã chọn.',
    );
    errors.when(locations.length !== locationIds.length, 'locationIds', 'Khu vực được chọn không tồn tại.');
    errors.when(
      locations.some((l) => !buildingIds.includes(l.buildingId)),
      'locationIds',
      'Khu vực phải nằm trong tòa nhà được giao.',
    );
    errors.throwIfAny();
    if (!role) throw fieldError('roleDefId', 'Cần chọn vai trò.');
    return { role, buildings, locations, department };
  }

  private async revokeSessions(manager: EntityManager, userId: string): Promise<void> {
    await manager.getRepository(RefreshToken).update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private recordAudit(manager: EntityManager, actor: AuthenticatedUser, user: User, action: string, reason: string) {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.ACCOUNT,
      subjectId: user.id,
      buildingId: null,
      action,
      actorId: actor.id,
      entityVersion: user.version,
      reason,
    });
  }
}
