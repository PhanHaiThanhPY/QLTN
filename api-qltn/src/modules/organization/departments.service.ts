import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, notFound } from '../../common/errors';
import { FieldErrors } from '../../common/validation/field-errors';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Building } from '../buildings/entities/building.entity';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { Department } from './entities/department.entity';

export interface DepartmentView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  buildingIds: string[];
  memberCount: number;
  version: number;
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Departments that cover at least one of the viewer's buildings (or no building at all). */
  async list(viewer: AuthenticatedUser): Promise<DepartmentView[]> {
    const rows = await this.dataSource
      .getRepository(Department)
      .find({ relations: { buildings: true }, order: { code: 'ASC' } });
    const counts = await this.memberCounts();
    return rows
      .filter((d) => d.buildings.length === 0 || d.buildings.some((b) => viewer.buildingIds.includes(b.id)))
      .map((d) => this.toView(d, counts.get(d.id) ?? 0));
  }

  async create(actor: AuthenticatedUser, dto: CreateDepartmentDto): Promise<DepartmentView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Department);
      const buildings = await this.resolveBuildings(manager, actor, dto.buildingIds);
      if (await repo.existsBy({ code: dto.code })) new FieldErrors().add('code', 'Mã bộ phận đã tồn tại.').throwIfAny();
      const saved = await repo.save(
        repo.create({ code: dto.code, name: dto.name, description: dto.description ?? null, buildings }),
      );
      await this.recordAudit(manager, actor, saved, 'createDepartment');
      return this.toView(saved, 0);
    });
  }

  /** Scope cannot shrink below the buildings of current members. */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateDepartmentDto): Promise<DepartmentView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Department);
      const locked = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw notFound('Không tìm thấy bộ phận.');
      assertVersion(locked.version, dto.version);
      const department = await repo.findOneOrFail({ where: { id }, relations: { buildings: true } });
      const buildings = await this.resolveBuildings(manager, actor, dto.buildingIds);

      const errors = new FieldErrors();
      const duplicate = await repo
        .createQueryBuilder('d')
        .where('d.code = :code AND d.id <> :id', { code: dto.code, id })
        .getExists();
      errors.when(duplicate, 'code', 'Mã bộ phận đã tồn tại.');
      const outside = await manager.query<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM users u JOIN user_buildings ub ON ub.user_id = u.id
           WHERE u.department_id = $1 AND NOT (ub.building_id = ANY($2::uuid[]))
         ) AS exists`,
        [id, dto.buildingIds],
      );
      errors.when(
        outside[0].exists,
        'buildingIds',
        'Không thể thu hẹp phạm vi: bộ phận đang có nhân viên ngoài phạm vi mới.',
      );
      errors.throwIfAny();

      department.code = dto.code;
      department.name = dto.name;
      department.description = dto.description ?? null;
      department.buildings = buildings;
      department.version += 1;
      const saved = await repo.save(department);
      await this.recordAudit(manager, actor, saved, 'updateDepartment');
      const counts = await this.memberCounts();
      return this.toView(saved, counts.get(saved.id) ?? 0);
    });
  }

  private async resolveBuildings(manager: EntityManager, actor: AuthenticatedUser, ids: string[]): Promise<Building[]> {
    const buildings = await manager.getRepository(Building).findBy({ id: In(ids) });
    new FieldErrors()
      .when(buildings.length !== ids.length, 'buildingIds', 'Tòa nhà được chọn không tồn tại.')
      .when(
        ids.some((id) => !actor.buildingIds.includes(id)),
        'buildingIds',
        'Chỉ gán tòa trong phạm vi của bạn.',
      )
      .throwIfAny();
    return buildings;
  }

  private async memberCounts(): Promise<Map<string, number>> {
    const rows = await this.dataSource.query<Array<{ department_id: string; count: number }>>(
      'SELECT department_id, count(*)::int AS count FROM users WHERE department_id IS NOT NULL GROUP BY department_id',
    );
    return new Map(rows.map((row) => [row.department_id, row.count]));
  }

  private recordAudit(manager: EntityManager, actor: AuthenticatedUser, department: Department, action: string) {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.ACCOUNT,
      subjectId: department.id,
      buildingId: null,
      action,
      actorId: actor.id,
      entityVersion: department.version,
      reason: `${department.code} – ${department.name}`,
    });
  }

  private toView(department: Department, memberCount: number): DepartmentView {
    return {
      id: department.id,
      code: department.code,
      name: department.name,
      description: department.description,
      buildingIds: department.buildings.map((b) => b.id).sort(),
      memberCount,
      version: department.version,
    };
  }
}
