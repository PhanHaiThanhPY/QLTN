import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type {
  Acceptance,
  ApprovalDecision,
  Attachment,
  AuditEvent,
  Building,
  BuildingConfig,
  CommandLog,
  Construction,
  Department,
  Location,
  MaintenanceItem,
  MaintenanceOccurrence,
  MaintenancePlan,
  MaintenanceReview,
  MaintenanceSubmission,
  MetaRow,
  Notification,
  Payment,
  PaymentDraft,
  PaymentRequest,
  ProposalDraft,
  RepairConfirmation,
  RepairRecord,
  RoleDefinition,
  ProposalSignature,
  StoredFile,
  Submission,
  Task,
  UnresolvedNotice,
  User,
} from '@/domain/types';

/**
 * v8: approval chain cleanup removes the legacy CSH/CĐT workflow roles.
 * v9: notifications indexed by eventKey; users carry an optimistic-lock version.
 * v10: records carry noMaintenanceItem; seed adds equipment in every building and links most repairs to an item.
 */
export const DB_NAME = 'qltn-demo-v10';
/** Every demo database name starts with this prefix; older ones are deleted on boot. */
export const DB_NAME_PREFIX = 'qltn-demo-v';
/** Bump together with a Dexie version() block; incompatible changes require a demo reset. */
export const SCHEMA_VERSION = 1;

export class DemoDatabase extends Dexie {
  users!: EntityTable<User, 'id'>;
  departments!: EntityTable<Department, 'id'>;
  buildings!: EntityTable<Building, 'id'>;
  buildingConfigs!: EntityTable<BuildingConfig, 'buildingId'>;
  roleDefs!: EntityTable<RoleDefinition, 'id'>;
  locations!: EntityTable<Location, 'id'>;
  records!: EntityTable<RepairRecord, 'id'>;
  repairConfirmations!: EntityTable<RepairConfirmation, 'id'>;
  proposalDrafts!: EntityTable<ProposalDraft, 'id'>;
  submissions!: EntityTable<Submission, 'id'>;
  approvalDecisions!: EntityTable<ApprovalDecision, 'id'>;
  signatures!: EntityTable<ProposalSignature, 'id'>;
  notices!: EntityTable<UnresolvedNotice, 'id'>;
  constructions!: EntityTable<Construction, 'id'>;
  acceptances!: EntityTable<Acceptance, 'id'>;
  paymentDrafts!: EntityTable<PaymentDraft, 'id'>;
  paymentRequests!: EntityTable<PaymentRequest, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  maintenanceItems!: EntityTable<MaintenanceItem, 'id'>;
  maintenancePlans!: EntityTable<MaintenancePlan, 'id'>;
  occurrences!: EntityTable<MaintenanceOccurrence, 'id'>;
  maintenanceSubmissions!: EntityTable<MaintenanceSubmission, 'id'>;
  maintenanceReviews!: EntityTable<MaintenanceReview, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;
  auditEvents!: EntityTable<AuditEvent, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  commandLogs!: EntityTable<CommandLog, 'commandId'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      users: 'id, code, departmentId',
      departments: 'id, &code',
      buildings: 'id, &code',
      buildingConfigs: 'buildingId',
      roleDefs: 'id, &code',
      locations: 'id, buildingId',
      records: 'id, &code, buildingId, status, maintenanceItemId, sourceMaintenanceOccurrenceId',
      repairConfirmations: 'id, recordId',
      proposalDrafts: 'id, &recordId',
      submissions: 'id, recordId',
      approvalDecisions: 'id, recordId, submissionId',
      signatures: 'id, recordId, submissionId',
      notices: 'id, &recordId, buildingId',
      constructions: 'id, &recordId',
      acceptances: 'id, recordId',
      paymentDrafts: 'id, &recordId',
      paymentRequests: 'id, recordId',
      payments: 'id, recordId, paymentRequestId',
      maintenanceItems: 'id, buildingId, code',
      maintenancePlans: 'id, &code, buildingId, itemId, status',
      occurrences: 'id, &code, planId, itemId, buildingId, status, scheduledDate, &scheduleKey',
      maintenanceSubmissions: 'id, occurrenceId',
      maintenanceReviews: 'id, occurrenceId',
      attachments: 'id, [subjectType+subjectId], buildingId',
      files: 'id',
      auditEvents: 'id, [subjectType+subjectId], buildingId, createdAt',
      tasks: 'id, [subjectType+subjectId], assigneeId, status, buildingId',
      notifications: 'id, recipientId, buildingId, createdAt, eventKey',
      commandLogs: 'commandId',
      meta: 'key',
    });
  }
}

let instance: DemoDatabase | null = null;

export const getDb = (): DemoDatabase => {
  if (!instance) instance = new DemoDatabase();
  return instance;
};

/** Test hook: point services at a fresh database. */
export const setDb = (db: DemoDatabase | null): void => {
  instance = db;
};

/** All tables, used to open one transaction for a whole command. */
export const allTables = (db: DemoDatabase): Dexie.Table[] => db.tables;

const STALE_DB_PATTERN = /^qltn-demo-v\d+$/;

/**
 * Deletes demo databases left by older builds (each schema change uses a new DB_NAME).
 * Best effort only: listing databases is unavailable in some browsers, so failures are logged and ignored.
 */
export const deleteStaleDatabases = async (): Promise<string[]> => {
  try {
    const names = await Dexie.getDatabaseNames();
    const stale = names.filter((name) => name !== DB_NAME && name.startsWith(DB_NAME_PREFIX) && STALE_DB_PATTERN.test(name));
    await Promise.all(stale.map((name) => Dexie.delete(name)));
    return stale;
  } catch (error) {
    console.error('Could not delete old demo databases.', error);
    return [];
  }
};
