import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertBuildingInScope } from '../../common/auth/scope';
import { assertVersion, notFound } from '../../common/errors';
import { FieldErrors } from '../../common/validation/field-errors';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type { CreateLocationDto, SetLocationActiveDto, UpdateLocationDto } from './dto/building.dto';
import { Location } from './entities/location.entity';

export interface LocationView {
  id: string;
  buildingId: string;
  floor: string;
  zone: string | null;
  name: string;
  isActive: boolean;
  version: number;
}

const toView = (l: Location): LocationView => ({
  id: l.id,
  buildingId: l.buildingId,
  floor: l.floor,
  zone: l.zone,
  name: l.name,
  isActive: l.isActive,
  version: l.version,
});

/** Floors sort naturally ("B1", "2", "10", "Mái"), then names. */
export const compareLocations = (a: Pick<Location, 'floor' | 'name'>, b: Pick<Location, 'floor' | 'name'>) =>
  a.floor.localeCompare(b.floor, 'vi', { numeric: true }) || a.name.localeCompare(b.name, 'vi');

@Injectable()
export class LocationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(viewer: AuthenticatedUser, buildingId: string, includeInactive: boolean): Promise<LocationView[]> {
    assertBuildingInScope(viewer, buildingId);
    const rows = await this.dataSource
      .getRepository(Location)
      .findBy(includeInactive ? { buildingId } : { buildingId, isActive: true });
    return rows.sort(compareLocations).map(toView);
  }

  async create(actor: AuthenticatedUser, buildingId: string, dto: CreateLocationDto): Promise<LocationView> {
    assertBuildingInScope(actor, buildingId);
    return this.dataSource.transaction(async (manager) => {
      await this.assertNameFree(manager, buildingId, dto.floor, dto.name);
      const repo = manager.getRepository(Location);
      const saved = await repo.save(
        repo.create({ buildingId, floor: dto.floor, name: dto.name, zone: dto.zone ?? null, isActive: true }),
      );
      await this.recordAudit(manager, actor, saved, 'createLocation');
      return toView(saved);
    });
  }

  async update(
    actor: AuthenticatedUser,
    buildingId: string,
    id: string,
    dto: UpdateLocationDto,
  ): Promise<LocationView> {
    assertBuildingInScope(actor, buildingId);
    return this.dataSource.transaction(async (manager) => {
      const location = await this.lock(manager, buildingId, id);
      assertVersion(location.version, dto.version);
      await this.assertNameFree(manager, buildingId, dto.floor, dto.name, id);
      location.floor = dto.floor;
      location.name = dto.name;
      location.zone = dto.zone ?? null;
      location.version += 1;
      const saved = await manager.getRepository(Location).save(location);
      await this.recordAudit(manager, actor, saved, 'updateLocation');
      return toView(saved);
    });
  }

  /** Inactive locations stay on existing records and items but are hidden from new selections. */
  async setActive(
    actor: AuthenticatedUser,
    buildingId: string,
    id: string,
    dto: SetLocationActiveDto,
  ): Promise<LocationView> {
    assertBuildingInScope(actor, buildingId);
    return this.dataSource.transaction(async (manager) => {
      const location = await this.lock(manager, buildingId, id);
      assertVersion(location.version, dto.version);
      location.isActive = dto.active;
      location.version += 1;
      const saved = await manager.getRepository(Location).save(location);
      await this.recordAudit(manager, actor, saved, dto.active ? 'activateLocation' : 'deactivateLocation');
      return toView(saved);
    });
  }

  private async lock(manager: EntityManager, buildingId: string, id: string): Promise<Location> {
    const location = await manager
      .getRepository(Location)
      .findOne({ where: { id, buildingId }, lock: { mode: 'pessimistic_write' } });
    if (!location) throw notFound('Không tìm thấy vị trí.');
    return location;
  }

  private async assertNameFree(
    manager: EntityManager,
    buildingId: string,
    floor: string,
    name: string,
    exceptId?: string,
  ) {
    const qb = manager
      .getRepository(Location)
      .createQueryBuilder('l')
      .where('l.building_id = :buildingId AND l.floor = :floor AND lower(l.name) = lower(:name)', {
        buildingId,
        floor,
        name,
      });
    if (exceptId) qb.andWhere('l.id <> :exceptId', { exceptId });
    new FieldErrors().when(await qb.getExists(), 'name', 'Tầng này đã có vị trí cùng tên.').throwIfAny();
  }

  private recordAudit(manager: EntityManager, actor: AuthenticatedUser, location: Location, action: string) {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.BUILDING,
      subjectId: location.buildingId,
      buildingId: location.buildingId,
      action,
      actorId: actor.id,
      entityVersion: location.version,
      reason: `${location.name} · tầng ${location.floor}`,
    });
  }
}
