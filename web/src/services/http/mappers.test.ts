import { AppError, ERROR_CODE } from '@/domain/errors';
import { CAPABILITY } from '@/domain/permissions';
import { mapRole, mapUserProfile } from './mappers';
import type { ApiUserProfile } from './mappers';

const profile = (overrides: Partial<ApiUserProfile> = {}): ApiUserProfile => ({
  id: '6f1b0d0a-0000-4000-8000-000000000001',
  code: 'BQL-A',
  username: 'bql-a',
  fullName: 'Trần BQL Tòa A',
  role: 'BQL',
  capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT, CAPABILITY.REPORT_VIEW],
  buildingIds: ['9a0b0d0a-0000-4000-8000-00000000000a'],
  locationIds: [],
  departmentId: '2a0b0d0a-0000-4000-8000-000000000002',
  jobTitle: 'Quản lý tòa nhà',
  email: 'bql-a@example.com',
  phone: '0900000001',
  departmentName: 'Ban quản lý',
  roleDefId: null,
  roleName: null,
  isActive: true,
  version: 3,
  lastLoginAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('mapUserProfile', () => {
  it('should map the backend profile onto the web User field by field', () => {
    const user = mapUserProfile(profile());

    expect(user).toEqual({
      id: '6f1b0d0a-0000-4000-8000-000000000001',
      code: 'BQL-A',
      fullName: 'Trần BQL Tòa A',
      role: 'BQL',
      departmentId: '2a0b0d0a-0000-4000-8000-000000000002',
      jobTitle: 'Quản lý tòa nhà',
      email: 'bql-a@example.com',
      phone: '0900000001',
      buildingIds: ['9a0b0d0a-0000-4000-8000-00000000000a'],
      locationIds: undefined,
      active: true,
      roleDefId: undefined,
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT, CAPABILITY.REPORT_VIEW],
      version: 3,
    });
  });

  it('should not leak backend-only fields (username, departmentName, roleName, lastLoginAt)', () => {
    const user = mapUserProfile(profile());
    expect(user).not.toHaveProperty('username');
    expect(user).not.toHaveProperty('departmentName');
    expect(user).not.toHaveProperty('roleName');
    expect(user).not.toHaveProperty('lastLoginAt');
    expect(user).not.toHaveProperty('isActive');
  });

  it('should read null/empty backend fields as undefined and keep a real location scope', () => {
    const user = mapUserProfile(profile({ departmentId: null, jobTitle: null, email: null, phone: '', roleDefId: 'role-1', locationIds: ['loc-1'] }));

    expect(user.departmentId).toBeUndefined();
    expect(user.jobTitle).toBeUndefined();
    expect(user.email).toBeUndefined();
    expect(user.phone).toBeUndefined();
    expect(user.roleDefId).toBe('role-1');
    expect(user.locationIds).toEqual(['loc-1']);
  });

  it('should keep an empty capability list as an explicit narrowing', () => {
    expect(mapUserProfile(profile({ capabilities: [] })).capabilities).toEqual([]);
    expect(mapUserProfile(profile({ capabilities: undefined })).capabilities).toBeUndefined();
  });

  it('should drop capabilities the web domain does not know', () => {
    expect(mapUserProfile(profile({ capabilities: [CAPABILITY.VIEW, 'UNKNOWN_CAPABILITY'] })).capabilities).toEqual([CAPABILITY.VIEW]);
  });

  it('should default a missing version and treat a missing isActive as active', () => {
    const user = mapUserProfile(profile({ version: undefined, isActive: undefined }));
    expect(user.version).toBe(1);
    expect(user.active).toBe(true);
  });

  it('should map every mirrored system role', () => {
    expect(mapRole('ADMIN')).toBe('ADMIN');
    expect(mapRole('BQL')).toBe('BQL');
    expect(mapRole('TECH_CONFIRMER')).toBe('TECH_CONFIRMER');
    expect(mapRole('TECH_CONSULTANT')).toBe('TECH_CONSULTANT');
    expect(mapRole('OWNERS_BOARD')).toBe('OWNERS_BOARD');
  });

  it('should refuse an unsupported backend role instead of guessing one', () => {
    expect(() => mapRole('SUPER_USER')).toThrow(AppError);
    try {
      mapRole('SUPER_USER');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODE.FORBIDDEN);
    }
  });
});
