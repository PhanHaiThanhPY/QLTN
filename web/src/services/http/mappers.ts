import { ROLE } from '@/domain/constants';
import type { Role } from '@/domain/constants';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { CAPABILITY } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type { User } from '@/domain/types';

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
