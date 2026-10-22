import type { Capability } from './permissions';
import type {
  ApprovalStepKey,
  ApprovalStepDefinition,
  BusinessWorkflowStepKey,
  AttachmentPurpose,
  Priority,
  RepairStatus,
  Role,
  SubjectType,
  TaskKind,
  NotificationKind,
} from './constants';

/** ISO 8601 UTC timestamp. */
export type IsoDateTime = string;
/** Calendar date YYYY-MM-DD (Vietnam time). */
export type IsoDate = string;

export interface Versioned {
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---------- Shared ----------

export interface User {
  id: string;
  code: string;
  fullName: string;
  /** System role; drives which workflow slots the user can hold. */
  role: Role;
  /** Organization unit used by workflow assignment rules. */
  departmentId?: string;
  /** Job title shown in the employee directory. */
  jobTitle?: string;
  email?: string;
  phone?: string;
  buildingIds: string[];
  /** Optional location scope inside the assigned buildings. */
  locationIds?: string[];
  active: boolean;
  /** Custom role copied from a role template (may only narrow the system role's permissions). */
  roleDefId?: string;
  /** Capabilities of the custom role, copied onto the user when assigned. */
  capabilities?: Capability[];
  /** Optimistic lock for account edits. */
  version: number;
}

/** Role shown in "Tài khoản và vai trò": system roles are fixed; custom roles narrow a system role. */
export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  baseRole: Role;
  capabilities: Capability[];
  isSystem: boolean;
  /** Role it was copied from. */
  sourceRoleId?: string;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Per-building settings (proposal 2.9); new records keep the values that applied when they were created. */
export interface BuildingConfig {
  buildingId: string;
  templateKey?: string;
  /** Display metadata for the building-scoped workflow designer. */
  workflowName?: string;
  workflowDescription?: string;
  /** Independent approval chains for each operational stage. */
  workflowStages?: WorkflowStageConfig[];
  taskDueDays: Partial<Record<TaskKind, number>>;
  /** Ordered approval roles applied to new repair records in this building. */
  approvalStepKeys: ApprovalStepKey[];
  /** Customer-defined approval steps. A record snapshots these definitions when it is created. */
  workflowApprovalSteps?: WorkflowApprovalStep[];
  /** Approval order per operational stage; proposal remains mirrored by approvalStepKeys. */
  workflowStageApprovalStepKeys?: Partial<Record<WorkflowStageKey, ApprovalStepKey[]>>;
  /** Optional workflow assignment rules. Empty or missing means use legacy role-based fallback. */
  assignmentRules?: AssignmentRule[];
  emergencyLimitVnd: number;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
  version: number;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export type WorkflowStageKey = 'INTAKE' | 'PROPOSAL' | 'ACCEPTANCE' | 'PAYMENT';

export interface WorkflowStageConfig {
  key: WorkflowStageKey;
  label: string;
  description: string;
  approvalStepKeys: ApprovalStepKey[];
  businessStepKeys?: BusinessWorkflowStepKey[];
  stepBindings?: WorkflowStepBinding[];
  enabled: boolean;
}

/** One customer-configured proposal approval step. `roleDefId` targets a custom role; otherwise `role` targets a system role. */
export interface WorkflowApprovalStep extends ApprovalStepDefinition {
  role: Role;
}

/** Connects a business action to the approval step that owns or follows it. */
export interface WorkflowStepBinding {
  businessStepKey: BusinessWorkflowStepKey;
  approvalStepKey?: ApprovalStepKey;
}

/** Resolves a workflow slot to a department within a building and optional locations. */
export interface AssignmentRule {
  departmentId: string;
  role: Role;
  /** Empty or missing means every location in the building. */
  locationIds?: string[];
  priority: number;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  address: string;
}

/** Organization unit used to resolve workflow assignees. */
export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  buildingIds: string[];
}

export interface Location {
  id: string;
  buildingId: string;
  floor: string;
  /** Khu vực (wing/zone), optional. */
  zone?: string;
  name: string;
  /** Inactive locations stay on old records but cannot be chosen for new ones. */
  active?: boolean;
}

export interface Attachment {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string;
  purpose: AttachmentPurpose;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Key of the Blob row in the files table. */
  contentRef: string;
  uploadedBy: string;
  createdAt: IsoDateTime;
}

export interface StoredFile {
  id: string;
  blob: Blob;
}

export interface AuditEvent {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string;
  commandId: string;
  action: string;
  actorId: string;
  triggeredBy?: string;
  fromStatus?: string;
  toStatus?: string;
  entityVersion: number;
  reason?: string;
  createdAt: IsoDateTime;
}

export type TaskStatus = 'OPEN' | 'DONE';
export type TaskCompletionReason = 'COMPLETED' | 'REASSIGNED' | 'CANCELLED' | 'CLOSED';

export interface Task {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string;
  assigneeId: string;
  kind: TaskKind;
  status: TaskStatus;
  dueAt?: IsoDateTime;
  createdAt: IsoDateTime;
  completedAt?: IsoDateTime;
  completionReason?: TaskCompletionReason;
}

export interface Notification {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string;
  recipientId: string;
  title: string;
  message: string;
  createdAt: IsoDateTime;
  readAt?: IsoDateTime;
  kind?: NotificationKind;
  /** Stable key used to prevent repeated reminders for the same task deadline. */
  eventKey?: string;
  dueAt?: IsoDateTime;
}

export interface CommandLog {
  commandId: string;
  actorId: string;
  action: string;
  payloadHash: string;
  result: CommandSuccess;
  createdAt: IsoDateTime;
}

export interface CommandSuccess {
  ok: true;
  subjectId?: string;
  data?: Record<string, unknown>;
}

// ---------- Repair ----------

export interface RepairRecord extends Versioned {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  maintenanceItemId?: string;
  /** "Không thuộc thiết bị cụ thể" (structural repairs: walls, ceilings…); exclusive with maintenanceItemId. */
  noMaintenanceItem?: boolean;
  sourceMaintenanceOccurrenceId?: string;
  title: string;
  description: string;
  priority: Priority;
  status: RepairStatus;
  managerUserId: string;
  confirmationUserId: string;
  /** Compatibility fields for the built-in consultant and board roles. */
  consultantUserId: string;
  boardUserId: string;
  /** Snapshot of the building approval order taken when this record was created. */
  approvalStepKeys: ApprovalStepKey[];
  /** Snapshot of the approval definitions used by the runtime workflow. */
  workflowApprovalSteps?: WorkflowApprovalStep[];
  workflowStageApprovalStepKeys?: Partial<Record<WorkflowStageKey, ApprovalStepKey[]>>;
  /** Resolved assignee for each configured approval step. */
  approvalAssigneeUserIds?: Record<string, string>;
  /** Current dynamic approval step when the status is PENDING_CUSTOM_APPROVAL. */
  currentApprovalStepKey?: ApprovalStepKey;
  /** Current payment approval step when the payment stage has a custom chain. */
  currentPaymentApprovalStepKey?: ApprovalStepKey;
  /** Approval steps still pending in the current acceptance round. */
  pendingApprovalStepKeys?: ApprovalStepKey[];
  /** Reviewers (KT, TVKT) who still have to decide the current acceptance round. */
  pendingAcceptanceSlots?: ('confirmer' | 'consultant')[];
  currentSubmissionId?: string;
  approvedSubmissionId?: string;
  /** Set when the unresolved notice has been issued (closes the BQL task). */
  noticeIssuedAt?: IsoDateTime;
  /** Due days of the building configuration when the record was created (later config changes do not apply). */
  dueDays?: Partial<Record<TaskKind, number>>;
  emergency?: EmergencyInfo;
  attachmentIds: string[];
  createdBy: string;
  dueAt?: IsoDateTime;
  closedAt?: IsoDateTime;
}

/** Emergency repair started before approval (proposal 2.5): documents must follow within the configured hours. */
export interface EmergencyInfo {
  startedAt: IsoDateTime;
  startedBy: string;
  reason: string;
  estimatedAmountVnd: number;
  contractorName: string;
  limitVnd: number;
  docsDueAt: IsoDateTime;
  /** Set when the proposal is submitted. */
  docsSubmittedAt?: IsoDateTime;
  /** Required when the documents are submitted after docsDueAt. */
  lateReason?: string;
}

export type RepairConfirmationOutcome = 'CONFIRMED' | 'NEEDS_UPDATE' | 'NO_REPAIR';
export interface RepairConfirmation {
  id: string;
  recordId: string;
  actorId: string;
  outcome: RepairConfirmationOutcome;
  note: string;
  createdAt: IsoDateTime;
}

/** Proposal being prepared: free-text contractor name and price, no quote comparison (customer decision 12/10/2026). */
export interface ProposalDraft {
  id: string;
  recordId: string;
  proposal: string;
  contractorName: string;
  amountVnd?: number;
  attachmentIds: string[];
  version: number;
  updatedAt: IsoDateTime;
}

export interface Submission {
  id: string;
  recordId: string;
  attemptNo: number;
  proposal: string;
  contractorName: string;
  amountVnd: number;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: IsoDateTime;
}

export type ApprovalOutcome = 'APPROVED' | 'NEEDS_UPDATE' | 'REJECTED';
export interface ApprovalDecision {
  id: string;
  submissionId: string;
  recordId: string;
  step: ApprovalStepKey;
  actorId: string;
  outcome: ApprovalOutcome;
  reason?: string;
  createdAt: IsoDateTime;
}

export type SignatureKind = 'SUBMITTER';

/** Drawn signature (mouse/touch) bound to one submission; a new submission must be signed again. Not a digital certificate. */
export interface ProposalSignature {
  id: string;
  recordId: string;
  submissionId: string;
  attemptNo: number;
  kind: SignatureKind;
  actorId: string;
  imageDataUrl: string;
  signedAt: IsoDateTime;
}

export type NoticeStatus = 'DRAFT' | 'ISSUED';

/** Notice drafted by the system when the third submission is rejected (proposal 2.4); BQL edits then issues it. */
export interface UnresolvedNotice {
  id: string;
  recordId: string;
  buildingId: string;
  title: string;
  body: string;
  status: NoticeStatus;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  issuedAt?: IsoDateTime;
  issuedBy?: string;
}

export interface ConstructionLog {
  id: string;
  actorId: string;
  note: string;
  progressPercent: number;
  attachmentIds: string[];
  createdAt: IsoDateTime;
}

export interface Construction {
  id: string;
  recordId: string;
  startDate: IsoDate;
  plannedEndDate: IsoDate;
  completedDate?: IsoDate;
  progressPercent: number;
  logs: ConstructionLog[];
  /** Fix notes saved while NEEDS_REPAIR (saveRepairEvidence). */
  repairEvidence?: { note: string; attachmentIds: string[]; updatedAt: IsoDateTime };
}

export type AcceptanceResult = 'PENDING' | 'PASSED' | 'FAILED';
export type AcceptanceReviewer = 'confirmer' | 'consultant';

/** One reviewer's decision inside an acceptance round. */
export interface AcceptanceCheck {
  reviewer: AcceptanceReviewer;
  stepKey?: ApprovalStepKey;
  reviewerLabel?: string;
  actorId: string;
  passed: boolean;
  note: string;
  reportAttachmentIds: string[];
  checkedAt: IsoDateTime;
}

/** A round passes when both KT and TVKT pass; one failure fails the round. */
export interface Acceptance {
  id: string;
  recordId: string;
  roundNo: number;
  submittedBy: string;
  submittedAt: IsoDateTime;
  submissionNote: string;
  result: AcceptanceResult;
  checks: AcceptanceCheck[];
  attachmentIds: string[];
}

export interface PaymentDraft {
  id: string;
  recordId: string;
  amountVnd: number;
  attachmentIds: string[];
  version: number;
  updatedAt: IsoDateTime;
}

export type PaymentDecision = 'APPROVED' | 'NEEDS_UPDATE';
export interface PaymentRequest {
  id: string;
  recordId: string;
  revisionNo: number;
  amountVnd: number;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: IsoDateTime;
  decision?: PaymentDecision;
  decidedBy?: string;
  decidedAt?: IsoDateTime;
  reason?: string;
  approvalStepKeys?: ApprovalStepKey[];
  currentApprovalStepKey?: ApprovalStepKey;
  approvalAssigneeUserIds?: Record<string, string>;
  approvalDecisions?: PaymentApprovalDecision[];
}

export interface PaymentApprovalDecision {
  step: ApprovalStepKey;
  actorId: string;
  outcome: PaymentDecision;
  reason?: string;
  createdAt: IsoDateTime;
}

export interface Payment {
  id: string;
  paymentRequestId: string;
  recordId: string;
  amountVnd: number;
  paidDate: IsoDate;
  reference: string;
  attachmentIds: string[];
  recordedBy: string;
  createdAt: IsoDateTime;
}

export * from './maintenance-types';

// ---------- Meta ----------

export interface DemoSettings {
  latencyMs: number;
  failNextCommand: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
