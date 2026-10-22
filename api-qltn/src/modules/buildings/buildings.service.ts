import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { assertVersion, notFound } from '../../common/errors';
import { FieldErrors, fieldError } from '../../common/validation/field-errors';
import { templateValues } from '../../domain/building-config';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { BuildingConfigService } from './building-config.service';
import type { CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';
import { Building } from './entities/building.entity';

export interface BuildingView {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  version: number;
}

const toView = (b: Building): BuildingView => ({
  id: b.id,
  code: b.code,
  name: b.name,
  address: b.address,
  isActive: b.isActive,
  version: b.version,
});

@Injectable()
export class BuildingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly configs: BuildingConfigService,
  ) {}

  async list(viewer: AuthenticatedUser): Promise<BuildingView[]> {
    if (viewer.buildingIds.length === 0) return [];
    const rows = await this.dataSource
      .getRepository(Building)
      .find({ where: { id: In(viewer.buildingIds) }, order: { code: 'ASC' } });
    return rows.map(toView);
  }

  async get(viewer: AuthenticatedUser, id: string): Promise<BuildingView> {
    assertBuildingInScope(viewer, id);
    const building = await this.dataSource.getRepository(Building).findOneBy({ id });
    if (!building) throw notFound('Không tìm thấy tòa nhà trong phạm vi của bạn.');
    return toView(building);
  }

  /** The new building starts from a template and joins the creator's scope. */
  async create(actor: AuthenticatedUser, dto: CreateBuildingDto): Promise<BuildingView> {
    const values = templateValues(dto.templateKey ?? 'STANDARD');
    if (!values) throw fieldError('templateKey', 'Cấu hình mẫu không hợp lệ.');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Building);
      if (await repo.existsBy({ code: dto.code })) new FieldErrors().add('code', 'Mã tòa đã tồn tại.').throwIfAny();
      const building = await repo.save(repo.create({ code: dto.code, name: dto.name, address: dto.address }));
      await this.configs.createInitial(manager, actor, building.id, values);
      await manager.query('INSERT INTO user_buildings (user_id, building_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        actor.id,
        building.id,
      ]);
      await this.recordAudit(manager, actor, building, 'createBuilding', `Theo mẫu ${values.templateKey ?? ''}`);
      return toView(building);
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateBuildingDto): Promise<BuildingView> {
    assertBuildingInScope(actor, id);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Building);
      const building = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!building) throw notFound('Không tìm thấy tòa nhà trong phạm vi của bạn.');
      assertVersion(building.version, dto.version);
      building.name = dto.name;
      building.address = dto.address;
      building.version += 1;
      const saved = await repo.save(building);
      await this.recordAudit(manager, actor, saved, 'updateBuilding', `${saved.code} – ${saved.name}`);
      return toView(saved);
    });
  }

  private recordAudit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    building: Building,
    action: string,
    reason: string,
  ) {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.BUILDING,
      subjectId: building.id,
      buildingId: building.id,
      action,
      actorId: actor.id,
      entityVersion: building.version,
      reason,
    });
  }
}
