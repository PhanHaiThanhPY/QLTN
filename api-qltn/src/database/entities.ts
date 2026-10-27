import { AuditEvent } from '../modules/audit/entities/audit-event.entity';
import { Attachment } from '../modules/attachments/entities/attachment.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { BuildingConfig } from '../modules/buildings/entities/building-config.entity';
import { Building } from '../modules/buildings/entities/building.entity';
import { Location } from '../modules/buildings/entities/location.entity';
import { ExploitationBidItem } from '../modules/exploitation/entities/exploitation-bid-item.entity';
import { ExploitationBid } from '../modules/exploitation/entities/exploitation-bid.entity';
import { ExploitationPackageRevision } from '../modules/exploitation/entities/exploitation-package-revision.entity';
import { ExploitationPackage } from '../modules/exploitation/entities/exploitation-package.entity';
import { ExploitationPartner } from '../modules/exploitation/entities/exploitation-partner.entity';
import { ExploitationSupplementRequest } from '../modules/exploitation/entities/exploitation-supplement-request.entity';
import { MaintenanceItem } from '../modules/maintenance/entities/maintenance-item.entity';
import { MaintenanceOccurrence } from '../modules/maintenance/entities/maintenance-occurrence.entity';
import { MaintenancePlan } from '../modules/maintenance/entities/maintenance-plan.entity';
import { MaintenanceScheduleVersion } from '../modules/maintenance/entities/maintenance-schedule-version.entity';
import { MaintenanceSkippedPeriod } from '../modules/maintenance/entities/maintenance-skipped-period.entity';
import { Department } from '../modules/organization/entities/department.entity';
import { RoleDefinition } from '../modules/roles/entities/role-definition.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { RepairAcceptanceDecision } from '../modules/records/entities/repair-acceptance-decision.entity';
import { RepairAcceptance } from '../modules/records/entities/repair-acceptance.entity';
import { RepairConfirmation } from '../modules/records/entities/repair-confirmation.entity';
import { RepairConstructionUpdate } from '../modules/records/entities/repair-construction-update.entity';
import { RepairConstruction } from '../modules/records/entities/repair-construction.entity';
import { RepairPaymentDecision } from '../modules/records/entities/repair-payment-decision.entity';
import { RepairPayment } from '../modules/records/entities/repair-payment.entity';
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
  RepairPayment,
  RepairPaymentDecision,
  MaintenanceItem,
  MaintenancePlan,
  MaintenanceScheduleVersion,
  MaintenanceOccurrence,
  MaintenanceSkippedPeriod,
  ExploitationPartner,
  ExploitationPackage,
  ExploitationPackageRevision,
  ExploitationBid,
  ExploitationBidItem,
  ExploitationSupplementRequest,
];
