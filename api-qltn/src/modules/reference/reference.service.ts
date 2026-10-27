import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { Role } from '../../domain/permissions';
import { Building } from '../buildings/entities/building.entity';
import { Location } from '../buildings/entities/location.entity';
import { MaintenanceItem } from '../maintenance/entities/maintenance-item.entity';
import { compareLocations } from '../buildings/locations.service';
import { Department } from '../organization/entities/department.entity';
import { User } from '../users/entities/user.entity';

/** Directory entry for pickers; no contact or security details. */
export interface ReferenceUser {
  id: string;
  code: string;
  fullName: string;
  role: Role;
  roleDefId: string | null;
  departmentId: string | null;
  jobTitle: string | null;
  buildingIds: string[];
  locationIds: string[];
  isActive: boolean;
}

export interface ReferenceData {
  buildings: Array<{ id: string; code: string; name: string; address: string | null; isActive: boolean }>;
  departments: Array<{ id: string; code: string; name: string; buildingIds: string[] }>;
  locations: Array<{
    id: string;
    buildingId: string;
    floor: string;
    zone: string | null;
    name: string;
    isActive: boolean;
  }>;
  users: ReferenceUser[];
  /** Equipment of the buildings, in use or not, for pickers and names (MT-S1 BR-MT-09); code order. */
  items: ReferenceItem[];
}

export interface ReferenceItem {
  id: string;
  code: string;
  name: string;
  type: string;
  buildingId: string;
  locationId: string;
  active: boolean;
}

/** Lookup lists limited to the viewer's buildings (mirrors web getReferenceData). */
@Injectable()
export class ReferenceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get(viewer: AuthenticatedUser): Promise<ReferenceData> {
    const scope = viewer.buildingIds;
    if (scope.length === 0) return { buildings: [], departments: [], locations: [], users: [], items: [] };
    const inScope = (ids: readonly string[]) => ids.some((id) => scope.includes(id));

    const [buildings, departments, locations, users, items] = await Promise.all([
      this.dataSource.getRepository(Building).find({ where: { id: In(scope) }, order: { code: 'ASC' } }),
      this.dataSource.getRepository(Department).find({ relations: { buildings: true }, order: { code: 'ASC' } }),
      this.dataSource.getRepository(Location).findBy({ buildingId: In(scope) }),
      this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.buildings', 'b')
        .leftJoinAndSelect('u.locations', 'l')
        .where('EXISTS (SELECT 1 FROM user_buildings ub WHERE ub.user_id = u.id AND ub.building_id IN (:...scope))', {
          scope,
        })
        .orderBy('u.code', 'ASC')
        .getMany(),
      this.dataSource.getRepository(MaintenanceItem).find({ where: { buildingId: In(scope) }, order: { code: 'ASC' } }),
    ]);

    return {
      buildings: buildings.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        address: b.address,
        isActive: b.isActive,
      })),
      departments: departments
        .filter((d) => d.buildings.length === 0 || inScope(d.buildings.map((b) => b.id)))
        .map((d) => ({ id: d.id, code: d.code, name: d.name, buildingIds: d.buildings.map((b) => b.id).sort() })),
      locations: locations.sort(compareLocations).map((l) => ({
        id: l.id,
        buildingId: l.buildingId,
        floor: l.floor,
        zone: l.zone,
        name: l.name,
        isActive: l.isActive,
      })),
      users: users.map((u) => ({
        id: u.id,
        code: u.code,
        fullName: u.fullName,
        role: u.role,
        roleDefId: u.roleDefId,
        departmentId: u.departmentId,
        jobTitle: u.jobTitle,
        buildingIds: u.buildings.map((b) => b.id).sort(),
        locationIds: u.locations.map((l) => l.id).sort(),
        isActive: u.isActive,
      })),
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        buildingId: item.buildingId,
        locationId: item.locationId,
        active: item.active,
      })),
    };
  }
}
