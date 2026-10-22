import { AppError, ERROR_CODE } from '@/domain/errors';
import { CAPABILITY } from '@/domain/permissions';
import {
  MISSING_VERSION_MESSAGE,
  PASSWORD_LENGTH_MESSAGE,
  mapBuilding,
  mapDepartment,
  mapLocation,
  mapReferenceUser,
  mapRole,
  mapRoleDefinition,
  mapUser,
  mapUserProfile,
  passwordError,
  toCreateDepartmentBody,
  toCreateRoleBody,
  toCreateUserBody,
  toUpdateDepartmentBody,
  toUpdateRoleBody,
  toUpdateUserBody,
} from './mappers';
import type { ApiDepartment, ApiReferenceLocation, ApiReferenceUser, ApiRole, ApiUserProfile } from './mappers';

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

const department = (overrides: Partial<ApiDepartment> = {}): ApiDepartment => ({
  id: 'dep-1',
  code: 'KT',
  name: 'Kỹ thuật',
  description: 'Sửa chữa và bảo trì',
  buildingIds: ['bld-a', 'bld-b'],
  memberCount: 4,
  version: 7,
  ...overrides,
});

describe('mapDepartment', () => {
  it('should map the backend department, keep version and drop memberCount', () => {
    expect(mapDepartment(department())).toEqual({
      id: 'dep-1',
      code: 'KT',
      name: 'Kỹ thuật',
      description: 'Sửa chữa và bảo trì',
      buildingIds: ['bld-a', 'bld-b'],
      version: 7,
    });
  });

  it('should read an empty description as undefined and never share the backend array', () => {
    const source = department({ description: '', buildingIds: ['bld-a'] });
    const mapped = mapDepartment(source);
    expect(mapped.description).toBeUndefined();
    expect(mapped.buildingIds).not.toBe(source.buildingIds);
  });

  it('should leave the version undefined when the backend row has none (reference list)', () => {
    expect(mapDepartment(department({ version: undefined })).version).toBeUndefined();
  });
});

const role = (overrides: Partial<ApiRole> = {}): ApiRole => ({
  id: 'role-kt',
  code: 'KT',
  name: 'Kỹ thuật',
  baseRole: 'TECH_CONFIRMER',
  capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT],
  isSystem: true,
  sourceRoleId: null,
  holderCount: 3,
  version: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

describe('mapRoleDefinition', () => {
  it('should map baseRole, capabilities and timestamps', () => {
    expect(mapRoleDefinition(role())).toEqual({
      id: 'role-kt',
      code: 'KT',
      name: 'Kỹ thuật',
      baseRole: 'TECH_CONFIRMER',
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT],
      isSystem: true,
      sourceRoleId: undefined,
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('should keep a custom role source and drop unknown capabilities', () => {
    const mapped = mapRoleDefinition(role({ isSystem: false, sourceRoleId: 'role-bql', capabilities: [CAPABILITY.VIEW, 'NOT_A_CAPABILITY'] }));
    expect(mapped.isSystem).toBe(false);
    expect(mapped.sourceRoleId).toBe('role-bql');
    expect(mapped.capabilities).toEqual([CAPABILITY.VIEW]);
  });

  it('should not leak holderCount', () => {
    expect(mapRoleDefinition(role())).not.toHaveProperty('holderCount');
  });
});

describe('mapUser', () => {
  it('should use the same explicit mapping as the profile', () => {
    expect(mapUser(profile())).toEqual(mapUserProfile(profile()));
  });
});

describe('mapReferenceUser / mapBuilding / mapLocation', () => {
  const referenceUser = (overrides: Partial<ApiReferenceUser> = {}): ApiReferenceUser => ({
    id: 'usr-1',
    code: 'KT-A3',
    fullName: 'Nguyễn Văn Minh',
    role: 'TECH_CONFIRMER',
    roleDefId: null,
    departmentId: 'dep-kt',
    jobTitle: 'Kỹ thuật viên',
    buildingIds: ['bld-a'],
    locationIds: ['loc-a-5'],
    isActive: true,
    ...overrides,
  });

  it('should map a reference user with a placeholder version (no contact details on the backend)', () => {
    const user = mapReferenceUser(referenceUser());
    expect(user).toEqual({
      id: 'usr-1',
      code: 'KT-A3',
      fullName: 'Nguyễn Văn Minh',
      role: 'TECH_CONFIRMER',
      departmentId: 'dep-kt',
      jobTitle: 'Kỹ thuật viên',
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
      active: true,
      roleDefId: undefined,
      version: 1,
    });
    expect(user).not.toHaveProperty('email');
    expect(user).not.toHaveProperty('phone');
  });

  it('should keep an empty location scope undefined and map an inactive user', () => {
    const user = mapReferenceUser(referenceUser({ locationIds: [], isActive: false }));
    expect(user.locationIds).toBeUndefined();
    expect(user.active).toBe(false);
  });

  it('should map a reference building and location', () => {
    expect(mapBuilding({ id: 'bld-a', code: 'A', name: 'Tòa A', address: null, isActive: true })).toEqual({
      id: 'bld-a',
      code: 'A',
      name: 'Tòa A',
      address: '',
    });
    const location: ApiReferenceLocation = {
      id: 'loc-a-5',
      buildingId: 'bld-a',
      floor: '5',
      zone: 'Bắc',
      name: 'Phòng 501',
      isActive: true,
    };
    expect(mapLocation(location)).toEqual({ id: 'loc-a-5', buildingId: 'bld-a', floor: '5', zone: 'Bắc', name: 'Phòng 501', active: true });
    expect(mapLocation({ ...location, zone: null, isActive: false })).toEqual({
      id: 'loc-a-5',
      buildingId: 'bld-a',
      floor: '5',
      zone: undefined,
      name: 'Phòng 501',
      active: false,
    });
  });
});

describe('user payload mappers', () => {
  const webPayload = {
    code: 'kt-a3',
    fullName: '  Nguyễn Văn Minh ',
    departmentId: 'dep-kt',
    jobTitle: '',
    email: 'minh@example.com',
    phone: '',
    roleDefId: 'role-kt',
    buildingIds: ['bld-a', 7, 'bld-b'],
    locationIds: ['loc-a-5'],
    password: 'MatKhau@123',
  };

  it('should build a CreateUserDto with trimmed values, null for empty optionals and an untrimmed password', () => {
    expect(toCreateUserBody(webPayload)).toEqual({
      code: 'kt-a3',
      fullName: 'Nguyễn Văn Minh',
      roleDefId: 'role-kt',
      buildingIds: ['bld-a', 'bld-b'],
      locationIds: ['loc-a-5'],
      departmentId: 'dep-kt',
      jobTitle: null,
      email: 'minh@example.com',
      phone: null,
      password: 'MatKhau@123',
    });
  });

  it('should not trim a password that starts or ends with a space', () => {
    expect(toCreateUserBody({ ...webPayload, password: '  secret123  ' }).password).toBe('  secret123  ');
  });

  it('should reject a missing or out-of-range password before calling the backend', () => {
    expect(passwordError('1234567')).toBe(PASSWORD_LENGTH_MESSAGE);
    expect(passwordError('x'.repeat(73))).toBe(PASSWORD_LENGTH_MESSAGE);
    expect(passwordError(undefined)).toBe(PASSWORD_LENGTH_MESSAGE);
    expect(passwordError('12345678')).toBeUndefined();
    expect(() => toCreateUserBody({ ...webPayload, password: 'short' })).toThrow(AppError);
    try {
      toCreateUserBody({ ...webPayload, password: '' });
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODE.VALIDATION_ERROR);
      expect((error as AppError).fieldErrors).toEqual({ password: PASSWORD_LENGTH_MESSAGE });
    }
  });

  it('should build an UpdateUserDto carrying version = expectedVersion and omitting an unset active', () => {
    const body = toUpdateUserBody(webPayload, 4);
    expect(body).toEqual({
      fullName: 'Nguyễn Văn Minh',
      roleDefId: 'role-kt',
      buildingIds: ['bld-a', 'bld-b'],
      locationIds: ['loc-a-5'],
      departmentId: 'dep-kt',
      jobTitle: null,
      email: 'minh@example.com',
      phone: null,
      version: 4,
    });
    expect(body).not.toHaveProperty('active');
    expect(body).not.toHaveProperty('password');
    expect(toUpdateUserBody({ ...webPayload, active: false }, 4).active).toBe(false);
  });

  it('should refuse an update without expectedVersion', () => {
    try {
      toUpdateUserBody(webPayload, undefined);
      throw new Error('Expected a conflict');
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODE.CONFLICT);
    }
  });
});

describe('department payload mappers', () => {
  const webPayload = {
    code: ' kt-moi ',
    name: '  Kỹ thuật mới ',
    description: '   ',
    buildingIds: ['bld-a', 7, 'bld-a', 'bld-b'],
  };

  it('should build a CreateDepartmentDto with an upper-cased code, null empty description and unique buildings', () => {
    expect(toCreateDepartmentBody(webPayload)).toEqual({
      code: 'KT-MOI',
      name: 'Kỹ thuật mới',
      description: null,
      buildingIds: ['bld-a', 'bld-b'],
    });
  });

  it('should keep a real description and carry version = expectedVersion on update', () => {
    const body = toUpdateDepartmentBody({ ...webPayload, description: ' Phụ trách sửa chữa ' }, 4);
    expect(body).toEqual({
      code: 'KT-MOI',
      name: 'Kỹ thuật mới',
      description: 'Phụ trách sửa chữa',
      buildingIds: ['bld-a', 'bld-b'],
      version: 4,
    });
  });

  it('should refuse an update without expectedVersion', () => {
    try {
      toUpdateDepartmentBody(webPayload, undefined);
      throw new Error('Expected a conflict');
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODE.CONFLICT);
      expect((error as AppError).message).toBe(MISSING_VERSION_MESSAGE);
    }
  });
});

describe('role payload mappers', () => {
  it('should build a CreateRoleDto from a base role with known, unique capabilities', () => {
    expect(
      toCreateRoleBody({
        name: ' Kỹ thuật tòa A ',
        baseRole: 'TECH_CONFIRMER',
        capabilities: [CAPABILITY.VIEW, 'NOT_A_CAPABILITY', CAPABILITY.VIEW, CAPABILITY.RECORD_CONFIRM],
      }),
    ).toEqual({
      name: 'Kỹ thuật tòa A',
      baseRole: 'TECH_CONFIRMER',
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_CONFIRM],
    });
  });

  it('should copy a role by sending sourceRoleId and no baseRole', () => {
    const body = toCreateRoleBody({
      sourceRoleId: 'role-bql',
      baseRole: 'TECH_CONFIRMER',
      name: 'Bản sao BQL',
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT],
    });
    expect(body).toEqual({
      name: 'Bản sao BQL',
      sourceRoleId: 'role-bql',
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT],
    });
    expect(body).not.toHaveProperty('baseRole');
  });

  it('should omit an unknown base role so the backend answers with its own field error', () => {
    expect(toCreateRoleBody({ name: 'Vai trò lạ', baseRole: 'SUPER_USER', capabilities: [] })).toEqual({
      name: 'Vai trò lạ',
      capabilities: [],
    });
  });

  it('should build an UpdateRoleDto with version and no base/source role fields', () => {
    const body = toUpdateRoleBody(
      { name: 'Kỹ thuật tòa A', baseRole: 'TECH_CONFIRMER', sourceRoleId: 'role-kt', capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_CONFIRM] },
      5,
    );
    expect(body).toEqual({
      name: 'Kỹ thuật tòa A',
      capabilities: [CAPABILITY.VIEW, CAPABILITY.RECORD_CONFIRM],
      version: 5,
    });
    expect(body).not.toHaveProperty('baseRole');
    expect(body).not.toHaveProperty('sourceRoleId');
  });

  it('should refuse an update without expectedVersion', () => {
    try {
      toUpdateRoleBody({ name: 'Kỹ thuật tòa A', capabilities: [] }, undefined);
      throw new Error('Expected a conflict');
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODE.CONFLICT);
    }
  });
});
