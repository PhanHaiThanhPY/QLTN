import { AuditEvent } from '../modules/audit/entities/audit-event.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { BuildingConfig } from '../modules/buildings/entities/building-config.entity';
import { Building } from '../modules/buildings/entities/building.entity';
import { Location } from '../modules/buildings/entities/location.entity';
import { Department } from '../modules/organization/entities/department.entity';
import { RoleDefinition } from '../modules/roles/entities/role-definition.entity';
import { RepairRecord } from '../modules/records/entities/repair-record.entity';
import { User } from '../modules/users/entities/user.entity';

/** Every TypeORM entity must be listed here (no glob discovery). */
export const ALL_ENTITIES = [
  Building,
  BuildingConfig,
  Location,
  Department,
  RoleDefinition,
  User,
  RefreshToken,
  AuditEvent,
  RepairRecord,
];
