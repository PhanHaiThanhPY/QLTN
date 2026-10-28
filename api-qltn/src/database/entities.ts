import { AuditEvent } from '../modules/audit/entities/audit-event.entity';
import { Attachment } from '../modules/attachments/entities/attachment.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { BuildingConfig } from '../modules/buildings/entities/building-config.entity';
import { Building } from '../modules/buildings/entities/building.entity';
import { Location } from '../modules/buildings/entities/location.entity';
import { ExploitationSelection } from '../modules/exploitation/entities/exploitation-selection.entity';
import { ExploitationSelectionDecision } from '../modules/exploitation/entities/exploitation-selection-decision.entity';
import { ExploitationAssembly } from '../modules/exploitation/entities/exploitation-assembly.entity';
import { ExploitationContract } from '../modules/exploitation/entities/exploitation-contract.entity';
import { ExploitationContractRevision } from '../modules/exploitation/entities/exploitation-contract-revision.entity';
import { ExploitationReceivable } from '../modules/exploitation/entities/exploitation-receivable.entity';
import { ExploitationDeposit } from '../modules/exploitation/entities/exploitation-deposit.entity';
import { ExploitationDepositOffset } from '../modules/exploitation/entities/exploitation-deposit-offset.entity';
import { ExploitationHandover } from '../modules/exploitation/entities/exploitation-handover.entity';
import { ExploitationTermination } from '../modules/exploitation/entities/exploitation-termination.entity';
import { ExploitationWriteOff } from '../modules/exploitation/entities/exploitation-write-off.entity';
import { DepositBank } from '../modules/deposit/entities/deposit-bank.entity';
import { DepositInvitation } from '../modules/deposit/entities/deposit-invitation.entity';
import { DepositOffer } from '../modules/deposit/entities/deposit-offer.entity';
import { DepositSelection } from '../modules/deposit/entities/deposit-selection.entity';
import { ExploitationReceiptAllocation } from '../modules/exploitation/entities/exploitation-receipt-allocation.entity';
import { ExploitationReceipt } from '../modules/exploitation/entities/exploitation-receipt.entity';
import { BankMatch } from '../modules/fund/entities/bank-match.entity';
import { BankStatementImport } from '../modules/fund/entities/bank-statement-import.entity';
import { BankStatementLine } from '../modules/fund/entities/bank-statement-line.entity';
import { Fund } from '../modules/fund/entities/fund.entity';
import { FundLedgerEntry } from '../modules/fund/entities/fund-ledger-entry.entity';
import { FundTaxObligation } from '../modules/fund/entities/fund-tax-obligation.entity';
import { FundTaxPayment } from '../modules/fund/entities/fund-tax-payment.entity';
import { FundVoucherDecision } from '../modules/fund/entities/fund-voucher-decision.entity';
import { FundVoucher } from '../modules/fund/entities/fund-voucher.entity';
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
import { MaintenanceReminder } from '../modules/maintenance/entities/maintenance-reminder.entity';
import { MaintenanceSubmission } from '../modules/maintenance/entities/maintenance-submission.entity';
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
  MaintenanceSubmission,
  MaintenanceReminder,
  ExploitationPartner,
  ExploitationPackage,
  ExploitationPackageRevision,
  ExploitationBid,
  ExploitationBidItem,
  ExploitationSupplementRequest,
  ExploitationSelection,
  ExploitationSelectionDecision,
  ExploitationAssembly,
  ExploitationContract,
  ExploitationContractRevision,
  ExploitationReceivable,
  Fund,
  FundLedgerEntry,
  FundTaxObligation,
  FundTaxPayment,
  FundVoucher,
  FundVoucherDecision,
  ExploitationReceipt,
  ExploitationReceiptAllocation,
  ExploitationDeposit,
  BankStatementImport,
  BankStatementLine,
  BankMatch,
  ExploitationTermination,
  ExploitationHandover,
  ExploitationDepositOffset,
  ExploitationWriteOff,
  DepositBank,
  DepositInvitation,
  DepositOffer,
  DepositSelection,
];
