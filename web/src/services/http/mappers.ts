import { ROLE } from '@/domain/constants';
import type { Role } from '@/domain/constants';
import { AppError, ERROR_CODE, validationError } from '@/domain/errors';
import { CAPABILITY } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type { Building, Department, Location, RoleDefinition, User } from '@/domain/types';
import { asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';

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
 * Unused backend fields (`username`, `departmentName`, `roleName`, `lastLoginAt`) are dropped on purpose.
 */
export const mapUserProfile = (profile: ApiUserProfile): User => {
  const buildingIds = [...(profile.buildingIds ?? [])];
  const locationIds = [...(profile.locationIds ?? [])];
  return {
    id: profile.id,
    code: profile.code,
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

/** Backend-only `memberCount`/`version` are dropped: the web department has no optimistic lock. */
export const mapDepartment = (row: ApiDepartment): Department => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: optionalText(row.description),
  buildingIds: [...row.buildingIds],
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
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** `GET /reference` → `buildings` row. The web building has no active flag; `address` is a string. */
export interface ApiReferenceBuilding {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export const mapBuilding = (row: ApiReferenceBuilding): Building => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: optionalText(row.address) ?? '',
});

/** `GET /reference` → `locations` row; backend `isActive` becomes the optional web `active`. */
export interface ApiReferenceLocation {
  id: string;
  buildingId: string;
  floor: string;
  zone: string | null;
  name: string;
  isActive: boolean;
}

export const mapLocation = (row: ApiReferenceLocation): Location => ({
  id: row.id,
  buildingId: row.buildingId,
  floor: row.floor,
  zone: optionalText(row.zone),
  name: row.name,
  active: row.isActive,
});

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
}

/** `GET /reference` departments omit description/version/memberCount. */
export const mapReferenceDepartment = (row: ApiReference['departments'][number]): Department => ({
  id: row.id,
  code: row.code,
  name: row.name,
  buildingIds: [...row.buildingIds],
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
 * `username` is omitted so the backend derives it from the code.
 */
export const toCreateUserBody = (payload: unknown): ApiCreateUserBody => {
  const row = asRecord(payload);
  const passwordIssue = passwordError(row.password);
  if (passwordIssue) throw validationError({ password: passwordIssue }, passwordIssue);
  return {
    code: asString(row.code),
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
 * and is mandatory; `active` is forwarded only when the caller sets it explicitly.
 */
export const toUpdateUserBody = (payload: unknown, expectedVersion: number | undefined): ApiUpdateUserBody => {
  if (expectedVersion === undefined) {
    throw new AppError(ERROR_CODE.CONFLICT, 'Thiếu phiên bản dữ liệu (expectedVersion). Vui lòng tải lại.');
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
