import { AuditEvent } from '../modules/audit/entities/audit-event.entity';
import { Attachment } from '../modules/attachments/entities/attachment.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { BuildingConfig } from '../modules/buildings/entities/building-config.entity';
import { Building } from '../modules/buildings/entities/building.entity';
import { Location } from '../modules/buildings/entities/location.entity';
import { Department } from '../modules/organization/entities/department.entity';
import { RoleDefinition } from '../modules/roles/entities/role-definition.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { RepairAcceptanceDecision } from '../modules/records/entities/repair-acceptance-decision.entity';
import { RepairAcceptance } from '../modules/records/entities/repair-acceptance.entity';
import { RepairConfirmation } from '../modules/records/entities/repair-confirmation.entity';
import { RepairConstructionUpdate } from '../modules/records/entities/repair-construction-update.entity';
import { RepairConstruction } from '../modules/records/entities/repair-construction.entity';
import { RepairProposalDecision } from '../modules/records/entities/repair-proposal-decision.entity';
import { RepairProposalSubmission } from '../modules/records/entities/repair-proposal-submission.entity';
import { RepairRecord } from '../modules/records/entities/repair-record.entity';
import { RepairSignature } from '../modules/records/entities/repair-signature.entity';
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
  Attachment,
  RepairRecord,
  RepairConfirmation,
  RepairProposalSubmission,
  RepairProposalDecision,
  RepairSignature,
  RepairConstruction,
  RepairConstructionUpdate,
  RepairAcceptance,
  RepairAcceptanceDecision,
  Notification,
];
