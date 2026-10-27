import { mapEmergency, mapEmergencyPolicy, type ApiEmergency, type ApiEmergencyPolicy } from './emergency-mappers';
import { BUSINESS_WORKFLOW_STEPS, PRIORITY, REPAIR_STATUS, ROLE, SUBJECT_TYPE } from '@/domain/constants';
import type { BusinessWorkflowStepKey, RepairStatus, Role, SubjectType, TaskKind } from '@/domain/constants';
import { assignmentRulesOf, approvalStepKeysOf, CONFIG_DUE_KINDS, workflowApprovalDefinitionsOf, workflowStagesOf } from '@/domain/building-config';
import { AppError, ERROR_CODE, validationError } from '@/domain/errors';
import { CAPABILITY } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type {
  AssignmentRule,
  Attachment,
  AuditEvent,
  Building,
  BuildingConfig,
  Department,
  Location,
  RepairConfirmation,
  RepairConfirmationOutcome,
  RepairRecord,
  RoleDefinition,
  User,
  WorkflowApprovalStep,
  WorkflowStageConfig,
  WorkflowStageKey,
  WorkflowStepBinding,
} from '@/domain/types';
import { asNumber, asOptionalString, asRecord, asString, asStringArray, requireVndAmount } from '@/domain/validation';
import type { RecordDetail } from '../records-service';
import type { ExecutionHistory } from '@/domain/execution';
import type { PaymentHistory } from '@/domain/payment';
import { mapExecution } from './execution-mappers';
import { mapPaymentHistory } from './payment-mappers';
import { mapProposalHistory, type ApiProposalHistory } from './proposal-mappers';
import { MISSING_VERSION_MESSAGE } from './version';

/**
 * Account profile as returned by api-qltn (`GET /api/auth/me`, `user` in the login payload).
 * Field names follow the backend, not the web domain: see `mapUserProfile`.
 */
export interface ApiUserProfile {
  id: string;
  code: string;
  username?: string;
  fullName: string;
  role: string;
  capabilities?: readonly string[];
  buildingIds?: readonly string[];
  locationIds?: readonly string[];
  departmentId?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  departmentName?: string | null;
  roleDefId?: string | null;
  roleName?: string | null;
  isActive?: boolean;
  version?: number;
  lastLoginAt?: string | null;
}

const ROLE_BY_API: Readonly<Record<string, Role>> = {
  ADMIN: ROLE.ADMIN,
  BQL: ROLE.BQL,
  TECH_CONFIRMER: ROLE.TECH_CONFIRMER,
  TECH_CONSULTANT: ROLE.TECH_CONSULTANT,
  OWNERS_BOARD: ROLE.OWNERS_BOARD,
  ACCOUNTANT: ROLE.ACCOUNTANT,
};

const CAPABILITIES = new Set<string>(Object.values(CAPABILITY));

/** Backend role code → web role; an unsupported role must not silently fall back to a broader one. */
export const mapRole = (value: string): Role => {
  const role = ROLE_BY_API[value];
  if (!role) throw new AppError(ERROR_CODE.FORBIDDEN, `Vai trò tài khoản không được hỗ trợ: ${value}.`);
  return role;
};

/** Empty strings and null both mean "not set" on the web side. */
const optionalText = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const mapCapabilities = (values: readonly string[] | undefined): Capability[] | undefined => {
  if (!Array.isArray(values)) return undefined;
  return values.filter((value): value is Capability => CAPABILITIES.has(value));
};

/**
 * Explicit field-by-field mapping from the backend profile to the web `User`.
 * Unused backend fields (`departmentName`, `roleName`, `lastLoginAt`) are dropped on purpose.
 */
export const mapUserProfile = (profile: ApiUserProfile): User => {
  const buildingIds = [...(profile.buildingIds ?? [])];
  const locationIds = [...(profile.locationIds ?? [])];
  return {
    id: profile.id,
    code: profile.code,
    username: optionalText(profile.username),
    fullName: profile.fullName,
    role: mapRole(profile.role),
    departmentId: optionalText(profile.departmentId),
    jobTitle: optionalText(profile.jobTitle),
    email: optionalText(profile.email),
    phone: optionalText(profile.phone),
    buildingIds,
    locationIds: locationIds.length > 0 ? locationIds : undefined,
    active: profile.isActive ?? true,
    roleDefId: optionalText(profile.roleDefId),
    capabilities: mapCapabilities(profile.capabilities),
    version: profile.version ?? 1,
  };
};

/** A row of `GET /users` has the same shape as the signed-in profile. */
export type ApiUser = ApiUserProfile;

/** Explicit name for the list-row case; same fields as the profile, so one mapper covers both. */
export const mapUser = (row: ApiUser): User => mapUserProfile(row);

/** `GET /departments` row (`DepartmentView` on the backend). */
export interface ApiDepartment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  buildingIds: string[];
  memberCount?: number;
  version?: number;
}

/**
 * Backend-only `memberCount` is dropped. `version` is kept because `PATCH /departments/:id` requires the
 * version the screen loaded (T2b); reference departments (no version) still map without it.
 */
export const mapDepartment = (row: ApiDepartment): Department => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: optionalText(row.description),
  buildingIds: [...row.buildingIds],
  version: row.version,
});

/** `GET /roles` row (`RoleView` on the backend). */
export interface ApiRole {
  id: string;
  code: string;
  name: string;
  baseRole: string;
  capabilities: readonly string[];
  isSystem: boolean;
  sourceRoleId: string | null;
  newBaseCapabilities?: readonly string[];
  holderCount?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** `holderCount` is backend-only; unknown capabilities are dropped like on the profile. */
export const mapRoleDefinition = (row: ApiRole): RoleDefinition => ({
  id: row.id,
  code: row.code,
  name: row.name,
  baseRole: mapRole(row.baseRole),
  capabilities: mapCapabilities(row.capabilities) ?? [],
  isSystem: row.isSystem,
  sourceRoleId: optionalText(row.sourceRoleId),
  newBaseCapabilities: mapCapabilities(row.newBaseCapabilities ?? []) ?? [],
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** `GET /buildings` and `GET /reference` → `buildings` row. The web building has no active flag; `address` is a string. */
export interface ApiReferenceBuilding {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  /** Only `GET /buildings` returns it (`GET /reference` omits it). */
  version?: number;
}

export const mapBuilding = (row: ApiReferenceBuilding): Building => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: optionalText(row.address) ?? '',
  ...(typeof row.version === 'number' ? { version: row.version } : {}),
});

/** A row of `GET /buildings` (`BuildingView` on the backend); same shape as the reference row plus `version`. */
export type ApiBuilding = ApiReferenceBuilding;

/** `GET /buildings/:id/locations` and `GET /reference` → `locations` row; backend `isActive` becomes web `active`. */
export interface ApiReferenceLocation {
  id: string;
  buildingId: string;
  floor: string;
  zone: string | null;
  name: string;
  isActive: boolean;
  /** Only the locations endpoint returns it; the reference address book omits it. */
  version?: number;
}

export const mapLocation = (row: ApiReferenceLocation): Location => ({
  id: row.id,
  buildingId: row.buildingId,
  floor: row.floor,
  zone: optionalText(row.zone),
  name: row.name,
  active: row.isActive,
  ...(typeof row.version === 'number' ? { version: row.version } : {}),
});

/** A row of `GET /buildings/:id/locations` (`LocationView` on the backend). */
export type ApiLocation = ApiReferenceLocation;

/** `GET /reference` → `users` row: a picker entry, deliberately without contact details or a version. */
export interface ApiReferenceUser {
  id: string;
  code: string;
  fullName: string;
  role: string;
  roleDefId: string | null;
  departmentId: string | null;
  jobTitle: string | null;
  buildingIds: string[];
  locationIds: string[];
  isActive: boolean;
}

/**
 * Reference users carry no `version`; a picker entry is never used as an edit target
 * (screens load the full row from `GET /users` before editing), so version 1 is a placeholder.
 */
export const mapReferenceUser = (row: ApiReferenceUser): User => ({
  id: row.id,
  code: row.code,
  fullName: row.fullName,
  role: mapRole(row.role),
  departmentId: optionalText(row.departmentId),
  jobTitle: optionalText(row.jobTitle),
  buildingIds: [...row.buildingIds],
  locationIds: row.locationIds.length > 0 ? [...row.locationIds] : undefined,
  active: row.isActive,
  roleDefId: optionalText(row.roleDefId),
  version: 1,
});

/** `GET /reference` payload. */
export interface ApiReference {
  buildings: ApiReferenceBuilding[];
  departments: Array<{ id: string; code: string; name: string; buildingIds: string[] }>;
  locations: ApiReferenceLocation[];
  users: ApiReferenceUser[];
  /** MT-S1: equipment of the buildings for pickers and names (absent before MT-S1). */
  items?: ApiReferenceItem[];
}

export interface ApiReferenceItem {
  id: string;
  code: string;
  name: string;
  type: string;
  buildingId: string;
  locationId: string;
  active: boolean;
}

/** `GET /reference` departments omit description/version/memberCount. */
export const mapReferenceDepartment = (row: ApiReference['departments'][number]): Department => ({
  id: row.id,
  code: row.code,
  name: row.name,
  buildingIds: [...row.buildingIds],
});

// ---------- Building configuration and history (`api-qltn/src/modules/buildings`) ----------

const WORKFLOW_STAGE_KEYS = new Set<string>(['INTAKE', 'PROPOSAL', 'ACCEPTANCE', 'PAYMENT']);
const BUSINESS_STEP_KEYS = new Set<string>(BUSINESS_WORKFLOW_STEPS.map((step) => step.key));
const REPAIR_STATUSES = new Set<string>(Object.values(REPAIR_STATUS));
const SUBJECT_TYPES = new Set<string>(Object.values(SUBJECT_TYPE));

const isBusinessStepKey = (value: string): value is BusinessWorkflowStepKey => BUSINESS_STEP_KEYS.has(value);

const stageKeyOf = (value: string): WorkflowStageKey => {
  if (!WORKFLOW_STAGE_KEYS.has(value)) {
    throw new AppError(ERROR_CODE.NETWORK_ERROR, `Giai đoạn workflow không được hỗ trợ: ${value}.`);
  }
  return value as WorkflowStageKey;
};

/** Custom steps carry `PENDING_CUSTOM_APPROVAL`; any unknown backend status falls back to it. */
export const repairStatusOf = (value: string): RepairStatus =>
  REPAIR_STATUSES.has(value) ? (value as RepairStatus) : 'PENDING_CUSTOM_APPROVAL';

const subjectTypeOf = (value: string): SubjectType => {
  if (!SUBJECT_TYPES.has(value)) {
    throw new AppError(ERROR_CODE.NETWORK_ERROR, `Loại đối tượng lịch sử không được hỗ trợ: ${value}.`);
  }
  return value as SubjectType;
};

/** One approval step as returned inside `BuildingConfigView.workflowApprovalSteps`. */
export interface ApiWorkflowApprovalStep {
  key: string;
  label: string;
  actor: string;
  role: string;
  roleDefId?: string;
  status: string;
}

const mapWorkflowApprovalStep = (row: ApiWorkflowApprovalStep): WorkflowApprovalStep => {
  const roleDefId = optionalText(row.roleDefId);
  return {
    key: row.key,
    label: row.label,
    actor: row.actor,
    role: mapRole(row.role),
    status: repairStatusOf(row.status),
    ...(roleDefId ? { roleDefId } : {}),
  };
};

/** One stage as returned inside `BuildingConfigView.workflowStages`. */
export interface ApiWorkflowStage {
  key: string;
  label: string;
  description: string;
  approvalStepKeys: readonly string[];
  businessStepKeys?: readonly string[];
  stepBindings?: readonly { businessStepKey: string; approvalStepKey?: string }[];
  enabled?: boolean;
}

const mapWorkflowStage = (row: ApiWorkflowStage): WorkflowStageConfig => {
  const stepBindings = (row.stepBindings ?? []).flatMap((binding): WorkflowStepBinding[] => {
    if (!isBusinessStepKey(binding.businessStepKey)) return [];
    const approvalStepKey = optionalText(binding.approvalStepKey);
    return approvalStepKey
      ? [{ businessStepKey: binding.businessStepKey, approvalStepKey }]
      : [{ businessStepKey: binding.businessStepKey }];
  });
  return {
    key: stageKeyOf(row.key),
    label: row.label,
    description: row.description,
    approvalStepKeys: [...row.approvalStepKeys],
    businessStepKeys: (row.businessStepKeys ?? []).filter(isBusinessStepKey),
    stepBindings,
    enabled: row.enabled ?? true,
  };
};

/** One assignment rule as returned inside `BuildingConfigView.assignmentRules`. */
export interface ApiAssignmentRule {
  departmentId: string;
  role: string;
  locationIds?: string[];
  priority: number;
}

const mapAssignmentRule = (row: ApiAssignmentRule): AssignmentRule => ({
  departmentId: row.departmentId,
  role: mapRole(row.role),
  ...(row.locationIds && row.locationIds.length > 0 ? { locationIds: [...row.locationIds] } : {}),
  priority: row.priority,
});

/** `GET /buildings/:id/config` and `GET /building-configs` row (`BuildingConfigView` on the backend). */
export interface ApiBuildingConfig {
  buildingId: string;
  templateKey: string | null;
  workflowName: string | null;
  workflowDescription: string | null;
  taskDueDays: Readonly<Record<string, number>>;
  approvalStepKeys: readonly string[];
  workflowApprovalSteps: readonly ApiWorkflowApprovalStep[];
  workflowStages: readonly ApiWorkflowStage[];
  assignmentRules: readonly ApiAssignmentRule[];
  /** VND integer sent as a string (see the api-qltn README); the web config uses a number. */
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export const CONFIG_MONEY_MESSAGE = 'Hạn mức khẩn cấp từ máy chủ không hợp lệ.';

/** Backend money strings are positive VND integers; a malformed one must not become 0 silently. */
const vndAmount = (value: string): number => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,15}$/.test(text)) throw new AppError(ERROR_CODE.NETWORK_ERROR, CONFIG_MONEY_MESSAGE);
  return Number(text);
};

const taskDueDaysOf = (row: Readonly<Record<string, number>> | undefined): Partial<Record<TaskKind, number>> => {
  const days: Partial<Record<TaskKind, number>> = {};
  for (const { kind } of CONFIG_DUE_KINDS) {
    const value = row?.[kind];
    if (typeof value === 'number') days[kind] = value;
  }
  return days;
};

/**
 * Explicit backend → web mapping for a building configuration.
 * The money limit is converted from the backend VND string to the web `number`; nullable text becomes
 * `undefined`, the approval library gains the web system steps, and assignment rules are normalized.
 */
export const mapBuildingConfig = (row: ApiBuildingConfig): BuildingConfig => {
  const workflowApprovalSteps = workflowApprovalDefinitionsOf((row.workflowApprovalSteps ?? []).map(mapWorkflowApprovalStep));
  return {
    buildingId: row.buildingId,
    templateKey: optionalText(row.templateKey),
    workflowName: optionalText(row.workflowName),
    workflowDescription: optionalText(row.workflowDescription),
    workflowStages: workflowStagesOf((row.workflowStages ?? []).map(mapWorkflowStage)),
    taskDueDays: taskDueDaysOf(row.taskDueDays),
    approvalStepKeys: approvalStepKeysOf(row.approvalStepKeys, workflowApprovalSteps),
    workflowApprovalSteps,
    assignmentRules: assignmentRulesOf((row.assignmentRules ?? []).map(mapAssignmentRule)),
    emergencyLimitVnd: vndAmount(row.emergencyLimitVnd),
    emergencyDocHours: row.emergencyDocHours,
    recentRepairDays: row.recentRepairDays,
    repeatMinRecords: row.repeatMinRecords,
    priceRatio: row.priceRatio,
    version: row.version,
    updatedAt: row.updatedAt,
    updatedBy: optionalText(row.updatedBy) ?? '',
  };
};

/** `GET /buildings/:id/audit` row (`AuditEventView` on the backend, newest first). */
export interface ApiAuditEvent {
  id: string;
  subjectType: string;
  subjectId: string;
  buildingId: string | null;
  action: string;
  actorId: string | null;
  actorName?: string | null;
  entityVersion: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

/**
 * Backend has no `commandId` on an audit row, so the web field stays empty; `actorId`/`buildingId`/
 * `entityVersion` are nullable on the backend and map to empty/0 so the timeline still renders.
 */
export const mapAuditEvent = (row: ApiAuditEvent): AuditEvent => ({
  id: row.id,
  subjectType: subjectTypeOf(row.subjectType),
  subjectId: row.subjectId,
  buildingId: row.buildingId ?? '',
  commandId: '',
  action: row.action,
  actorId: row.actorId ?? '',
  entityVersion: row.entityVersion ?? 0,
  fromStatus: optionalText(row.fromStatus),
  toStatus: optionalText(row.toStatus),
  reason: optionalText(row.reason),
  createdAt: row.createdAt,
});

// ---------- Web payload → backend DTO (`api-qltn/src/modules/users/dto/user.dto.ts`) ----------

/** Same bounds as the backend `PASSWORD_MIN`/`PASSWORD_MAX`. */
export const PASSWORD_LIMITS = { MIN: 8, MAX: 72 } as const;
export const PASSWORD_LENGTH_MESSAGE = 'Mật khẩu phải có từ 8 đến 72 ký tự.';

/** Passwords are not trimmed: a space is a legitimate character, trimming would change the secret. */
const rawPassword = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Client-side mirror of the backend password rule; `undefined` means valid. */
export const passwordError = (value: unknown): string | undefined => {
  const password = rawPassword(value);
  return password.length >= PASSWORD_LIMITS.MIN && password.length <= PASSWORD_LIMITS.MAX
    ? undefined
    : PASSWORD_LENGTH_MESSAGE;
};

export interface ApiCreateUserBody {
  code: string;
  /** Omitted when empty so the backend derives it from `code`. */
  username?: string;
  fullName: string;
  roleDefId: string;
  buildingIds: string[];
  locationIds: string[];
  departmentId: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  password: string;
}

export interface ApiUpdateUserBody {
  fullName: string;
  roleDefId: string;
  buildingIds: string[];
  locationIds: string[];
  departmentId: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  active?: boolean;
  version: number;
}

/**
 * Web `createUser` payload → `CreateUserDto`. Empty optional text becomes `null` (backend `TrimToNull`);
 * an empty `username` is omitted so the backend derives it from the code.
 */
export const toCreateUserBody = (payload: unknown): ApiCreateUserBody => {
  const row = asRecord(payload);
  const passwordIssue = passwordError(row.password);
  if (passwordIssue) throw validationError({ password: passwordIssue }, passwordIssue);
  const username = asOptionalString(row.username);
  return {
    code: asString(row.code),
    ...(username ? { username } : {}),
    fullName: asString(row.fullName),
    roleDefId: asString(row.roleDefId),
    buildingIds: asStringArray(row.buildingIds),
    locationIds: asStringArray(row.locationIds),
    departmentId: asOptionalString(row.departmentId) ?? null,
    jobTitle: asOptionalString(row.jobTitle) ?? null,
    email: asOptionalString(row.email) ?? null,
    phone: asOptionalString(row.phone) ?? null,
    password: rawPassword(row.password),
  };
};

/**
 * Web `updateUser` payload → `UpdateUserDto`. `expectedVersion` is the optimistic lock the screen loaded
 * and is mandatory; `active` is forwarded only when the caller sets it explicitly. The login name is fixed
 * after creation, so `username` is never sent here.
 */
export { MISSING_VERSION_MESSAGE };

export const toUpdateUserBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateUserBody => {
  if (expectedVersion === undefined) {
    throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  }
  const row = asRecord(payload);
  const body: ApiUpdateUserBody = {
    fullName: asString(row.fullName),
    roleDefId: asString(row.roleDefId),
    buildingIds: asStringArray(row.buildingIds),
    locationIds: asStringArray(row.locationIds),
    departmentId: asOptionalString(row.departmentId) ?? null,
    jobTitle: asOptionalString(row.jobTitle) ?? null,
    email: asOptionalString(row.email) ?? null,
    phone: asOptionalString(row.phone) ?? null,
    version: expectedVersion,
  };
  if (typeof row.active === 'boolean') body.active = row.active;
  return body;
};

// ---------- Web payload → backend DTO (`api-qltn/src/modules/organization/dto/department.dto.ts`) ----------

export interface ApiCreateDepartmentBody {
  code: string;
  name: string;
  description: string | null;
  buildingIds: string[];
}

export interface ApiUpdateDepartmentBody extends ApiCreateDepartmentBody {
  version: number;
}

/** Known capability values, deduplicated: the backend rejects unknown values (`IsIn`) and duplicates (`ArrayUnique`). */
const knownCapabilities = (values: readonly string[]): Capability[] => {
  const kept = values.filter((value): value is Capability => CAPABILITIES.has(value));
  return [...new Set(kept)];
};

const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * Web `createDepartment` payload → `CreateDepartmentDto`. The code is upper-cased like the mock handler and
 * the backend `TrimUpper`; an empty description becomes `null` (backend `TrimToNull`).
 */
export const toCreateDepartmentBody = (payload: unknown): ApiCreateDepartmentBody => {
  const row = asRecord(payload);
  return {
    code: asString(row.code).toUpperCase(),
    name: asString(row.name),
    description: asOptionalString(row.description) ?? null,
    buildingIds: uniqueStrings(asStringArray(row.buildingIds)),
  };
};

/** Web `updateDepartment` payload → `UpdateDepartmentDto`; `version` is the optimistic lock the screen loaded. */
export const toUpdateDepartmentBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateDepartmentBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { ...toCreateDepartmentBody(payload), version: expectedVersion };
};

// ---------- Web payload → backend DTO (`api-qltn/src/modules/roles/dto/role.dto.ts`) ----------

export interface ApiCreateRoleBody {
  name: string;
  baseRole?: Role;
  sourceRoleId?: string;
  capabilities: Capability[];
}

export interface ApiUpdateRoleBody {
  name: string;
  capabilities: Capability[];
  version: number;
}

const isRoleValue = (value: string): value is Role => (Object.values(ROLE) as string[]).includes(value);

/**
 * Web `createRoleDef` payload → `CreateRoleDto`. The backend copies from `sourceRoleId` (it derives the base role
 * and initial capabilities itself), so `baseRole` is sent only when there is no source role; `capabilities` are
 * always forwarded because the screen shows the exact narrowed set. Unknown base roles are omitted so the backend
 * answers with its own Vietnamese field error.
 */
export const toCreateRoleBody = (payload: unknown): ApiCreateRoleBody => {
  const row = asRecord(payload);
  const body: ApiCreateRoleBody = {
    name: asString(row.name),
    capabilities: knownCapabilities(asStringArray(row.capabilities)),
  };
  const sourceRoleId = asOptionalString(row.sourceRoleId);
  const baseRole = asOptionalString(row.baseRole);
  if (sourceRoleId) body.sourceRoleId = sourceRoleId;
  else if (baseRole && isRoleValue(baseRole)) body.baseRole = baseRole;
  return body;
};

/** Web `updateRoleDef` payload → `UpdateRoleDto`: only the editable fields plus the loaded version. */
export const toUpdateRoleBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateRoleBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  const row = asRecord(payload);
  return {
    name: asString(row.name),
    capabilities: knownCapabilities(asStringArray(row.capabilities)),
    version: expectedVersion,
  };
};

// ---------- Web payload → backend DTO (`api-qltn/src/modules/buildings/dto/building.dto.ts`) ----------

export interface ApiCreateBuildingBody {
  code: string;
  name: string;
  address: string;
  templateKey?: string;
}

export interface ApiUpdateBuildingBody {
  name: string;
  address: string;
  version: number;
}

/**
 * Web `createBuilding` payload → `CreateBuildingDto`. The code is upper-cased like the mock handler and the
 * backend `TrimUpper`; an empty template is omitted so the backend applies `STANDARD`.
 */
export const toCreateBuildingBody = (payload: unknown): ApiCreateBuildingBody => {
  const row = asRecord(payload);
  const body: ApiCreateBuildingBody = {
    code: asString(row.code).toUpperCase(),
    name: asString(row.name),
    address: asString(row.address),
  };
  const templateKey = asOptionalString(row.templateKey);
  if (templateKey) body.templateKey = templateKey;
  return body;
};

/** Web `updateBuilding` payload → `UpdateBuildingDto`; `version` is the optimistic lock the screen loaded. */
export const toUpdateBuildingBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateBuildingBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  const row = asRecord(payload);
  return {
    name: asString(row.name),
    address: asString(row.address),
    version: expectedVersion,
  };
};

export interface ApiCreateLocationBody {
  floor: string;
  name: string;
  zone: string | null;
}

export interface ApiUpdateLocationBody extends ApiCreateLocationBody {
  version: number;
}

export interface ApiSetLocationActiveBody {
  active: boolean;
  version: number;
}

/** Web `createLocation` payload → `CreateLocationDto`; an empty zone is sent as `null`. */
export const toCreateLocationBody = (payload: unknown): ApiCreateLocationBody => {
  const row = asRecord(payload);
  return {
    floor: asString(row.floor),
    name: asString(row.name),
    zone: asOptionalString(row.zone) ?? null,
  };
};

/** Web `updateLocation` payload → `UpdateLocationDto`; `version` is the optimistic lock the screen loaded. */
export const toUpdateLocationBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateLocationBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { ...toCreateLocationBody(payload), version: expectedVersion };
};

/** Web `setLocationActive` payload → `SetLocationActiveDto`; like the mock handler, only `true` activates. */
export const toSetLocationActiveBody = (
  payload: unknown,
  expectedVersion: number | undefined,
): ApiSetLocationActiveBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { active: asRecord(payload).active === true, version: expectedVersion };
};

// ---------- Web configuration payload → backend `building-config.dto.ts` ----------

/** `taskDueDays` of `ConfigValuesDto`; a missing day is left out so the backend reports the field. */
export type ApiTaskDueDaysBody = Partial<Record<TaskKind, number>>;

export interface ApiApprovalStepBody {
  key: string;
  label: string;
  actor?: string;
  role: string;
  roleDefId?: string;
}

export interface ApiWorkflowStepBindingBody {
  businessStepKey: string;
  approvalStepKey?: string;
}

export interface ApiWorkflowStageBody {
  key: string;
  label: string;
  description: string;
  approvalStepKeys: string[];
  businessStepKeys: string[];
  stepBindings?: ApiWorkflowStepBindingBody[];
  enabled?: boolean;
}

export interface ApiAssignmentRuleBody {
  departmentId: string;
  role: string;
  locationIds?: string[];
  priority: number;
}

/** `ConfigValuesDto` — the workflow parts are optional on purpose: omitted means "keep the current value". */
export interface ApiConfigValuesBody {
  templateKey?: string;
  workflowName?: string | null;
  workflowDescription?: string | null;
  taskDueDays: ApiTaskDueDaysBody;
  approvalStepKeys?: string[];
  workflowApprovalSteps?: ApiApprovalStepBody[];
  workflowStages?: ApiWorkflowStageBody[];
  assignmentRules?: ApiAssignmentRuleBody[];
  /** VND integer as a string (the backend DTO rejects numbers for this field). */
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}

export interface ApiUpdateBuildingConfigBody extends ApiConfigValuesBody {
  version: number;
}

export interface ApiApplyConfigTemplateBody {
  templateKey?: string;
  sourceBuildingId?: string;
  version: number;
}

export interface ApiWorkflowTargetBody {
  buildingId: string;
  version: number;
  values: ApiConfigValuesBody;
}

export interface ApiBulkWorkflowUpdateBody {
  targets: ApiWorkflowTargetBody[];
}

/** `ConfigSaveResult` from api-qltn; only the change count and skipped parts matter to the web. */
export interface ApiConfigSaveResult {
  config: ApiBuildingConfig;
  changes: readonly unknown[];
  skipped?: readonly unknown[];
}

export type ApiConfigSkipReason = 'department_not_in_building' | 'locations_belong_to_source';

export interface ApiSkippedConfigPart {
  kind: 'assignment_rule';
  departmentId: string;
  reason: ApiConfigSkipReason;
}

const SKIP_REASONS: ReadonlySet<string> = new Set<ApiConfigSkipReason>([
  'department_not_in_building',
  'locations_belong_to_source',
]);

/** Parts the backend did not copy; unknown entries are ignored rather than shown to the user. */
export const mapSkippedConfigParts = (value: unknown): ApiSkippedConfigPart[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ApiSkippedConfigPart[] => {
    const row = asRecord(item);
    const kind = asOptionalString(row.kind);
    const departmentId = asOptionalString(row.departmentId);
    const reason = asOptionalString(row.reason);
    if (kind !== 'assignment_rule' || !departmentId || !reason || !SKIP_REASONS.has(reason)) return [];
    return [{ kind, departmentId, reason: reason as ApiConfigSkipReason }];
  });
};

const taskDueDaysBody = (value: unknown): ApiTaskDueDaysBody => {
  const row = asRecord(value);
  const days: ApiTaskDueDaysBody = {};
  for (const { kind } of CONFIG_DUE_KINDS) {
    const day = asNumber(row[kind]);
    if (day !== undefined) days[kind] = day;
  }
  return days;
};

/** The web `status` field is derived on the backend and is not part of `ApprovalStepDto`. */
const toApprovalStepBody = (value: unknown): ApiApprovalStepBody => {
  const row = asRecord(value);
  const step: ApiApprovalStepBody = {
    key: asString(row.key),
    label: asString(row.label),
    role: asString(row.role),
  };
  const actor = asOptionalString(row.actor);
  if (actor) step.actor = actor;
  const roleDefId = asOptionalString(row.roleDefId);
  if (roleDefId) step.roleDefId = roleDefId;
  return step;
};

const toStepBindingBody = (value: unknown): ApiWorkflowStepBindingBody => {
  const row = asRecord(value);
  const binding: ApiWorkflowStepBindingBody = { businessStepKey: asString(row.businessStepKey) };
  const approvalStepKey = asOptionalString(row.approvalStepKey);
  if (approvalStepKey) binding.approvalStepKey = approvalStepKey;
  return binding;
};

const toWorkflowStageBody = (value: unknown): ApiWorkflowStageBody => {
  const row = asRecord(value);
  const stepBindings = Array.isArray(row.stepBindings) ? row.stepBindings.map(toStepBindingBody) : [];
  const stage: ApiWorkflowStageBody = {
    key: asString(row.key),
    label: asString(row.label),
    description: asString(row.description),
    approvalStepKeys: asStringArray(row.approvalStepKeys),
    businessStepKeys: asStringArray(row.businessStepKeys),
  };
  if (stepBindings.length > 0) stage.stepBindings = stepBindings;
  if (typeof row.enabled === 'boolean') stage.enabled = row.enabled;
  return stage;
};

const toAssignmentRuleBody = (value: unknown, index: number): ApiAssignmentRuleBody => {
  const row = asRecord(value);
  const locationIds = asStringArray(row.locationIds);
  return {
    departmentId: asString(row.departmentId),
    role: asString(row.role),
    ...(locationIds.length > 0 ? { locationIds } : {}),
    priority: asNumber(row.priority) ?? index + 1,
  };
};

/**
 * Web `ConfigValues` payload → `ConfigValuesDto`. Money goes from `number` to a VND string, the web
 * `WorkflowApprovalStep.status` is dropped, and optional parts are only sent when the screen included them
 * (the backend keeps the current value otherwise).
 */
export const toConfigValuesBody = (payload: unknown): ApiConfigValuesBody => {
  const row = asRecord(payload);
  const body: ApiConfigValuesBody = {
    taskDueDays: taskDueDaysBody(row.taskDueDays),
    emergencyLimitVnd: String(requireVndAmount(row.emergencyLimitVnd, 'emergencyLimitVnd', 'Hạn mức khẩn cấp')),
    emergencyDocHours: asNumber(row.emergencyDocHours) ?? 0,
    recentRepairDays: asNumber(row.recentRepairDays) ?? 0,
    repeatMinRecords: asNumber(row.repeatMinRecords) ?? 0,
    priceRatio: asNumber(row.priceRatio) ?? 0,
  };
  const templateKey = asOptionalString(row.templateKey);
  if (templateKey) body.templateKey = templateKey;
  if (row.workflowName !== undefined) body.workflowName = asOptionalString(row.workflowName) ?? null;
  if (row.workflowDescription !== undefined) body.workflowDescription = asOptionalString(row.workflowDescription) ?? null;
  if (Array.isArray(row.approvalStepKeys)) body.approvalStepKeys = asStringArray(row.approvalStepKeys);
  if (Array.isArray(row.workflowApprovalSteps)) body.workflowApprovalSteps = row.workflowApprovalSteps.map(toApprovalStepBody);
  if (Array.isArray(row.workflowStages)) body.workflowStages = row.workflowStages.map(toWorkflowStageBody);
  if (Array.isArray(row.assignmentRules)) body.assignmentRules = row.assignmentRules.map(toAssignmentRuleBody);
  return body;
};

/** Web `updateBuildingConfig` payload → `UpdateBuildingConfigDto`; `version` is the lock the screen loaded. */
export const toUpdateBuildingConfigBody = (
  payload: unknown,
  expectedVersion: number | undefined,
): ApiUpdateBuildingConfigBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { ...toConfigValuesBody(payload), version: expectedVersion };
};

/** Web `applyConfigTemplate` payload → `ApplyTemplateDto`: exactly one source, plus the version lock. */
export const toApplyConfigTemplateBody = (payload: unknown, expectedVersion: number | undefined): ApiApplyConfigTemplateBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  const row = asRecord(payload);
  const sourceBuildingId = asOptionalString(row.sourceBuildingId);
  if (sourceBuildingId) return { sourceBuildingId, version: expectedVersion };
  return { templateKey: asString(row.templateKey), version: expectedVersion };
};

/** Web `updateWorkflowConfig` payload → `BulkWorkflowUpdateDto`; every target needs a version, checked offline. */
export const toBulkWorkflowUpdateBody = (payload: unknown): ApiBulkWorkflowUpdateBody => {
  const targets = asRecord(payload).targets;
  const rows = Array.isArray(targets) ? targets : [];
  return {
    targets: rows.map((value): ApiWorkflowTargetBody => {
      const row = asRecord(value);
      const buildingId = asString(row.buildingId);
      if (!buildingId) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tòa nhà.');
      const version = asNumber(row.expectedVersion) ?? asNumber(row.version);
      if (version === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
      return { buildingId, version, values: toConfigValuesBody(row.values) };
    }),
  };
};

// ---------- Repair records (`api-qltn/src/modules/records`) ----------

/** One record as returned by `POST /records`, `PATCH /records/:id` and inside `GET /records/:id`. */
export interface ApiRepairRecord {
  id: string;
  code: string;
  buildingId: string;
  locationId: string | null;
  noMaintenanceItem: boolean;
  /** MT-S1: the record's equipment, or null. */
  maintenanceItemId?: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  managerUserId: string;
  confirmationUserId: string | null;
  consultantUserId: string | null;
  boardUserId: string | null;
  approvalStepKeys: readonly string[];
  workflowApprovalSteps?: readonly ApiWorkflowApprovalStep[];
  workflowStageApprovalStepKeys?: Readonly<Record<string, readonly string[]>>;
  approvalAssigneeUserIds?: Readonly<Record<string, string>>;
  dueDays?: Readonly<Record<string, number>>;
  attachmentIds?: readonly string[];
  /** S2: the step the proposal waits on and the submissions it points to. */
  currentApprovalStepKey?: string | null;
  currentSubmissionId?: string | null;
  approvedSubmissionId?: string | null;
  approvedAmountVnd?: string | null;
  executingContractorName?: string | null;
  /** B06-S1: emergency data, null for a regular record. */
  emergency?: ApiEmergency | null;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const PRIORITIES = new Set<string>(Object.values(PRIORITY));

const priorityOf = (value: string): RepairRecord['priority'] =>
  PRIORITIES.has(value) ? (value as RepairRecord['priority']) : 'NORMAL';

/** Backend → web `RepairRecord`; empty optional ids become the empty strings the demo uses. */
export const mapRepairRecord = (row: ApiRepairRecord): RepairRecord => {
  const stageKeys: Partial<Record<WorkflowStageKey, string[]>> = {};
  for (const [key, value] of Object.entries(row.workflowStageApprovalStepKeys ?? {})) {
    stageKeys[stageKeyOf(key)] = [...value];
  }
  return {
    id: row.id,
    code: row.code,
    buildingId: row.buildingId,
    locationId: row.locationId ?? '',
    ...(row.noMaintenanceItem ? { noMaintenanceItem: true } : {}),
    ...(row.maintenanceItemId ? { maintenanceItemId: row.maintenanceItemId } : {}),
    title: row.title,
    description: row.description,
    priority: priorityOf(row.priority),
    status: repairStatusOf(row.status),
    managerUserId: row.managerUserId,
    confirmationUserId: row.confirmationUserId ?? '',
    consultantUserId: row.consultantUserId ?? '',
    boardUserId: row.boardUserId ?? '',
    approvalStepKeys: [...row.approvalStepKeys],
    workflowApprovalSteps: (row.workflowApprovalSteps ?? []).map(mapWorkflowApprovalStep),
    workflowStageApprovalStepKeys: stageKeys,
    approvalAssigneeUserIds: { ...(row.approvalAssigneeUserIds ?? {}) },
    dueDays: taskDueDaysOf(row.dueDays),
    attachmentIds: [...(row.attachmentIds ?? [])],
    ...(row.currentApprovalStepKey ? { currentApprovalStepKey: row.currentApprovalStepKey } : {}),
    ...(row.currentSubmissionId ? { currentSubmissionId: row.currentSubmissionId } : {}),
    ...(row.approvedSubmissionId ? { approvedSubmissionId: row.approvedSubmissionId } : {}),
    ...(row.emergency ? { emergency: mapEmergency(row.emergency) } : {}),
    createdBy: row.createdBy,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/** One stored file as returned by `POST /attachments` and inside `GET /records/:id`. */
export interface ApiAttachment {
  id: string;
  subjectType: string;
  subjectId: string;
  buildingId: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

/** Backend attachment → web `Attachment`; the content is fetched separately by id. */
export const mapAttachment = (row: ApiAttachment): Attachment => ({
  id: row.id,
  subjectType: row.subjectType as SubjectType,
  subjectId: row.subjectId,
  buildingId: row.buildingId,
  purpose: row.purpose as Attachment['purpose'],
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  contentRef: row.id,
  uploadedBy: row.uploadedBy,
  createdAt: row.createdAt,
});

export interface ApiRepairConfirmation {
  id: string;
  recordId: string;
  actorId: string;
  outcome: RepairConfirmationOutcome;
  note: string;
  createdAt: string;
}

export const mapRepairConfirmation = (row: ApiRepairConfirmation): RepairConfirmation => ({
  id: row.id,
  recordId: row.recordId,
  actorId: row.actorId,
  outcome: row.outcome,
  note: row.note,
  createdAt: row.createdAt,
});

export interface ApiRecordDetail {
  record: ApiRepairRecord;
  confirmations?: readonly ApiRepairConfirmation[];
  attachments?: readonly ApiAttachment[];
  /** S2: proposal draft and submissions, and the quotation / minutes files they reference. */
  proposal?: ApiProposalHistory;
  proposalAttachments?: readonly ApiAttachment[];
  /** S3: construction, acceptance rounds and saved repair work. */
  execution?: ExecutionHistory;
  /** S4: payment instalments. */
  payment?: PaymentHistory;
  /** B06-S1: the building's current emergency limit and hours. */
  emergencyPolicy?: ApiEmergencyPolicy | null;
  /** MT-S1: the record's equipment line, null for "no specific equipment". */
  maintenanceItem?: { id: string; code: string; name: string; active: boolean } | null;
  audit?: readonly ApiAuditEvent[];
}

/**
 * Backend detail → web `RecordDetail`. The record, its files, the confirmer conclusions (S1), the quotation proposal
 * (S2) and the history; parts that arrive in later slices (construction, acceptance, payment) come back empty.
 * `attachments` holds site photos and proposal files so any file id on the screen resolves.
 */
export const mapRecordDetail = (row: ApiRecordDetail): RecordDetail => ({
  record: mapRepairRecord(row.record),
  confirmations: (row.confirmations ?? []).map(mapRepairConfirmation),
  submissions: [],
  quoteProposal: mapProposalHistory(row.proposal, row.record),
  execution: mapExecution(row.execution),
  paymentHistory: mapPaymentHistory(row.payment),
  emergencyPolicy: mapEmergencyPolicy(row.emergencyPolicy),
  ...(row.maintenanceItem ? { itemSummary: { ...row.maintenanceItem } } : {}),
  signatures: [],
  acceptances: [],
  paymentRequests: [],
  payments: [],
  attachments: [...(row.attachments ?? []), ...(row.proposalAttachments ?? [])].map(mapAttachment),
  audit: (row.audit ?? []).map(mapAuditEvent),
  alerts: [],
  inactiveSlots: [],
  isOverdue: false,
});

export interface ApiCreateRecordBody {
  buildingId: string;
  title: string;
  description: string;
  priority?: string;
  locationId?: string;
  confirmationUserId?: string;
  noMaintenanceItem?: boolean;
  maintenanceItemId?: string;
}

/** Web `createRecord` payload → `CreateRecordDto`; files are attached on the next draft save, so `attachmentIds` is dropped. */
export const toCreateRecordBody = (payload: unknown): ApiCreateRecordBody => {
  const row = asRecord(payload);
  const body: ApiCreateRecordBody = {
    buildingId: asString(row.buildingId),
    title: asString(row.title),
    description: asString(row.description),
  };
  const priority = asOptionalString(row.priority);
  if (priority) body.priority = priority;
  const locationId = asOptionalString(row.locationId);
  if (locationId) body.locationId = locationId;
  const confirmationUserId = asOptionalString(row.confirmationUserId);
  if (confirmationUserId) body.confirmationUserId = confirmationUserId;
  if (row.noMaintenanceItem === true) body.noMaintenanceItem = true;
  const maintenanceItemId = asOptionalString(row.maintenanceItemId);
  if (maintenanceItemId) body.maintenanceItemId = maintenanceItemId;
  return body;
};

export interface ApiUpdateRecordDraftBody {
  version: number;
  title?: string;
  description?: string;
  priority?: string;
  locationId?: string | null;
  confirmationUserId?: string | null;
  noMaintenanceItem?: boolean;
  /** MT-S1: the chosen item; null clears it. */
  maintenanceItemId?: string | null;
  /** Present = replace the record's file list (an empty array detaches every file). */
  attachmentIds?: string[];
}

/** Web `saveRecordDraft` payload → `UpdateRecordDraftDto`; `version` is the lock the screen loaded. */
export const toUpdateRecordDraftBody = (
  payload: unknown,
  expectedVersion: number | undefined,
): ApiUpdateRecordDraftBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  const row = asRecord(payload);
  const body: ApiUpdateRecordDraftBody = { version: expectedVersion };
  if (row.title !== undefined) body.title = asString(row.title);
  if (row.description !== undefined) body.description = asString(row.description);
  const priority = asOptionalString(row.priority);
  if (priority) body.priority = priority;
  // A partial payload (e.g. attachment-only save right after create) must not clear the other fields.
  if (row.locationId !== undefined) body.locationId = asOptionalString(row.locationId) ?? null;
  if (row.confirmationUserId !== undefined) {
    body.confirmationUserId = asOptionalString(row.confirmationUserId) ?? null;
  }
  if (row.noMaintenanceItem !== undefined) body.noMaintenanceItem = row.noMaintenanceItem === true;
  // An empty choice clears the item ("no specific equipment" is carried by noMaintenanceItem).
  if (row.maintenanceItemId !== undefined) body.maintenanceItemId = asOptionalString(row.maintenanceItemId) ?? null;
  if (row.attachmentIds !== undefined) body.attachmentIds = asStringArray(row.attachmentIds);
  return body;
};

/** Web `submitRecord` payload → `SubmitRecordDto` (same optional draft fields as a draft save). */
export const toSubmitRecordBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateRecordDraftBody =>
  toUpdateRecordDraftBody(payload, expectedVersion);

export interface ApiWithdrawRecordBody {
  version: number;
  reason: string;
}

/** Web `withdrawRecord` payload → `WithdrawRecordDto`. */
export const toWithdrawRecordBody = (
  payload: unknown,
  expectedVersion: number | undefined,
): ApiWithdrawRecordBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { version: expectedVersion, reason: asString(asRecord(payload).reason) };
};

export interface ApiConfirmRecordBody {
  version: number;
  note: string;
}

/** Web `requestRecordUpdate` / `confirmRepair` / `closeNoRepair` payload → `ConfirmRecordDto`. */
export const toConfirmRecordBody = (payload: unknown, expectedVersion: number | undefined): ApiConfirmRecordBody => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return { version: expectedVersion, note: asString(asRecord(payload).note) };
};
