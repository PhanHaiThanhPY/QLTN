// @vitest-environment jsdom
import { AppError, ERROR_CODE, isAppError } from '@/domain/errors';
import type { Command } from '../command-engine';
import { executeApiCommand, isApiAction } from './command-adapter';
import { clearApiSession, saveApiSession } from './token-store';

const jsonResponse = (status: number, body: unknown): Response =>
  ({ status, text: async () => (body === null ? '' : JSON.stringify(body)) }) as unknown as Response;

const successBody = (data: unknown): unknown => ({ success: true, data, timestamp: '2026-01-01T00:00:00.000Z', correlationId: null });

const errorBody = (code: string, message: string, details: unknown = null): unknown => ({
  success: false,
  error: { code, message, details },
  timestamp: '2026-01-01T00:00:00.000Z',
  correlationId: null,
});

const USER_PROFILE = {
  id: 'usr-9',
  code: 'KT-A3',
  username: 'kt-a3',
  fullName: 'Nguyễn Văn Minh',
  role: 'TECH_CONFIRMER',
  capabilities: ['VIEW'],
  buildingIds: ['bld-a'],
  locationIds: [],
  departmentId: 'dep-kt',
  jobTitle: null,
  email: null,
  phone: null,
  departmentName: 'Kỹ thuật',
  roleDefId: null,
  roleName: null,
  isActive: true,
  version: 1,
  lastLoginAt: null,
};

const mockFetch = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);
  return mock;
};

const bodyOf = (init: RequestInit | undefined): unknown => {
  const raw = init?.body;
  return typeof raw === 'string' ? (JSON.parse(raw) as unknown) : undefined;
};

const captureAppError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error('Expected the command to reject with an AppError.');
};

const createCommand = (payload: unknown = {}, overrides: Partial<Command> = {}): Command => ({
  commandId: 'cmd-1',
  subjectType: 'ACCOUNT',
  action: 'createUser',
  payload,
  ...overrides,
});

const CREATE_PAYLOAD = {
  code: 'KT-A3',
  fullName: 'Nguyễn Văn Minh',
  departmentId: 'dep-kt',
  jobTitle: '',
  email: '',
  phone: '',
  roleDefId: 'role-kt',
  buildingIds: ['bld-a'],
  locationIds: [],
  password: 'MatKhau@123',
};

const DEPARTMENT_VIEW = {
  id: 'dep-kt2',
  code: 'KT2',
  name: 'Kỹ thuật 2',
  description: 'Sửa chữa',
  buildingIds: ['bld-a'],
  memberCount: 0,
  version: 1,
};

const ROLE_VIEW = {
  id: 'role-vt1',
  code: 'VT-01',
  name: 'Kỹ thuật tòa A',
  baseRole: 'TECH_CONFIRMER',
  capabilities: ['VIEW', 'RECORD_CONFIRM'],
  isSystem: false,
  sourceRoleId: null,
  holderCount: 0,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('api command adapter', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  it('should register the accounts, departments, roles, buildings and locations actions wired so far', () => {
    expect(isApiAction('createUser')).toBe(true);
    expect(isApiAction('updateUser')).toBe(true);
    expect(isApiAction('createDepartment')).toBe(true);
    expect(isApiAction('updateDepartment')).toBe(true);
    expect(isApiAction('createRoleDef')).toBe(true);
    expect(isApiAction('updateRoleDef')).toBe(true);
    expect(isApiAction('createBuilding')).toBe(true);
    expect(isApiAction('updateBuilding')).toBe(true);
    expect(isApiAction('createLocation')).toBe(true);
    expect(isApiAction('updateLocation')).toBe(true);
    expect(isApiAction('setLocationActive')).toBe(true);
    // Out of scope: configuration/workflow writes and maintenance/profile actions stay unwired.
    expect(isApiAction('updateBuildingConfig')).toBe(false);
    expect(isApiAction('updateWorkflowConfig')).toBe(false);
    expect(isApiAction('applyConfigTemplate')).toBe(false);
    expect(isApiAction('replaceManager')).toBe(false);
    // A prototype key must not count as a registered action.
    expect(isApiAction('toString')).toBe(false);
  });

  it('should POST /users with the CreateUserDto body and return the new subject id', async () => {
    saveApiSession({ accessToken: 'tok-1', refreshToken: 'ref-1' });
    const mock = mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));

    await expect(executeApiCommand(createCommand(CREATE_PAYLOAD))).resolves.toEqual({ ok: true, subjectId: 'usr-9' });

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/users');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    expect(bodyOf(init)).toEqual({
      code: 'KT-A3',
      fullName: 'Nguyễn Văn Minh',
      roleDefId: 'role-kt',
      buildingIds: ['bld-a'],
      locationIds: [],
      departmentId: 'dep-kt',
      jobTitle: null,
      email: null,
      phone: null,
      password: 'MatKhau@123',
    });
  });

  it('should PATCH /users/:id with version = expectedVersion', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...USER_PROFILE, version: 5 })));
    const payload = { ...CREATE_PAYLOAD, password: undefined, fullName: 'Nguyễn Văn Nam' };

    await expect(
      executeApiCommand(createCommand(payload, { action: 'updateUser', subjectId: 'usr-9', expectedVersion: 4 })),
    ).resolves.toEqual({ ok: true, subjectId: 'usr-9' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/users/usr-9');
    expect(init?.method).toBe('PATCH');
    const body = bodyOf(init) as Record<string, unknown>;
    expect(body.version).toBe(4);
    expect(body.fullName).toBe('Nguyễn Văn Nam');
    expect(body).not.toHaveProperty('password');
  });

  it('should encode the id in the PATCH path', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));

    await executeApiCommand(createCommand({}, { action: 'updateUser', subjectId: 'a/b', expectedVersion: 1 }));

    expect(String(mock.mock.calls[0][0])).toBe('/api/users/a%2Fb');
  });

  it('should tell the screens a write happened so the list refetches', async () => {
    mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));
    const { subscribeLocalChanges } = await import('../change-channel');
    const listener = vi.fn();
    const unsubscribe = subscribeLocalChanges(listener);
    try {
      await executeApiCommand(createCommand(CREATE_PAYLOAD));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('should fail loudly for an action that is not wired yet', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({})));
    const error = await captureAppError(executeApiCommand(createCommand({}, { action: 'replaceManager' })));

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.message).toBe('Thao tác này chưa nối API.');
    expect(mock).not.toHaveBeenCalled();
  });

  it('should POST /departments with the CreateDepartmentDto body and return the new subject id', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody(DEPARTMENT_VIEW)));

    await expect(
      executeApiCommand(
        createCommand(
          { code: ' kt2 ', name: ' Kỹ thuật 2 ', description: '', buildingIds: ['bld-a', 'bld-a'] },
          { action: 'createDepartment' },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'dep-kt2' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/departments');
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toEqual({
      code: 'KT2',
      name: 'Kỹ thuật 2',
      description: null,
      buildingIds: ['bld-a'],
    });
  });

  it('should PATCH /departments/:id with version = expectedVersion', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...DEPARTMENT_VIEW, version: 3 })));
    const payload = { code: 'KT2', name: 'Kỹ thuật 2', description: 'Mô tả mới', buildingIds: ['bld-a', 'bld-b'] };

    await expect(
      executeApiCommand(
        createCommand(payload, { action: 'updateDepartment', subjectId: 'dep-kt2', expectedVersion: 2 }),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'dep-kt2' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/departments/dep-kt2');
    expect(init?.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ ...payload, version: 2 });
  });

  it('should refuse a department update without expectedVersion or subject id before hitting the network', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(DEPARTMENT_VIEW)));

    const noVersion = await captureAppError(
      executeApiCommand(createCommand({}, { action: 'updateDepartment', subjectId: 'dep-kt2' })),
    );
    expect(noVersion.code).toBe(ERROR_CODE.CONFLICT);

    const noId = await captureAppError(
      executeApiCommand(createCommand({}, { action: 'updateDepartment', expectedVersion: 1 })),
    );
    expect(noId.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(noId.message).toBe('Không tìm thấy bộ phận.');
    expect(mock).not.toHaveBeenCalled();
  });

  it('should POST /roles with a base role and the picked capabilities', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody(ROLE_VIEW)));

    await expect(
      executeApiCommand(
        createCommand(
          { baseRole: 'TECH_CONFIRMER', name: ' Kỹ thuật tòa A ', capabilities: ['VIEW', 'RECORD_CONFIRM'] },
          { action: 'createRoleDef' },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'role-vt1' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/roles');
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toEqual({
      name: 'Kỹ thuật tòa A',
      baseRole: 'TECH_CONFIRMER',
      capabilities: ['VIEW', 'RECORD_CONFIRM'],
    });
  });

  it('should copy a role by forwarding sourceRoleId (backend supports it natively) and no baseRole', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody({ ...ROLE_VIEW, sourceRoleId: 'role-kt' })));

    await executeApiCommand(
      createCommand(
        { sourceRoleId: 'role-kt', baseRole: 'TECH_CONFIRMER', name: 'Kỹ thuật tòa A (bản sao)', capabilities: ['VIEW'] },
        { action: 'createRoleDef' },
      ),
    );

    const body = bodyOf(mock.mock.calls[0][1]) as Record<string, unknown>;
    expect(body.sourceRoleId).toBe('role-kt');
    expect(body).not.toHaveProperty('baseRole');
  });

  it('should PATCH /roles/:id with the name, capabilities and version', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...ROLE_VIEW, version: 6 })));

    await expect(
      executeApiCommand(
        createCommand(
          { name: 'Kỹ thuật tòa A', sourceRoleId: 'role-kt', capabilities: ['VIEW'] },
          { action: 'updateRoleDef', subjectId: 'role-vt1', expectedVersion: 5 },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'role-vt1' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/roles/role-vt1');
    expect(init?.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ name: 'Kỹ thuật tòa A', capabilities: ['VIEW'], version: 5 });
  });

  it('should refuse a role update without expectedVersion and map a stale version (409) onto CONFLICT', async () => {
    mockFetch(() =>
      jsonResponse(409, errorBody('CONFLICT', 'Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.')),
    );

    const staleError = await captureAppError(
      executeApiCommand(
        createCommand({ name: 'Kỹ thuật tòa A', capabilities: ['VIEW'] }, { action: 'updateRoleDef', subjectId: 'role-vt1', expectedVersion: 4 }),
      ),
    );
    expect(staleError.code).toBe(ERROR_CODE.CONFLICT);
    expect(staleError.message).toContain('tải lại');

    const noVersion = await captureAppError(
      executeApiCommand(createCommand({}, { action: 'updateRoleDef', subjectId: 'role-vt1' })),
    );
    expect(noVersion.code).toBe(ERROR_CODE.CONFLICT);
  });

  it('should surface the backend field error when a role grants capabilities outside its base role', async () => {
    mockFetch(() =>
      jsonResponse(
        400,
        errorBody('VALIDATION_ERROR', 'Không thể cấp quyền ngoài vai trò gốc “Kỹ thuật”.', {
          fields: [{ field: 'capabilities', message: 'Không thể cấp quyền ngoài vai trò gốc “Kỹ thuật”.' }],
        }),
      ),
    );

    const error = await captureAppError(
      executeApiCommand(
        createCommand(
          { baseRole: 'TECH_CONFIRMER', name: 'Vai trò sai', capabilities: ['PAYMENT_DECIDE'] },
          { action: 'createRoleDef' },
        ),
      ),
    );

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.fieldErrors?.capabilities).toContain('ngoài vai trò gốc');
  });

  it('should map a stale version (409) onto CONFLICT with the backend message', async () => {
    mockFetch(() =>
      jsonResponse(409, errorBody('CONFLICT', 'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại trước khi thao tác.')),
    );

    const error = await captureAppError(
      executeApiCommand(createCommand({}, { action: 'updateUser', subjectId: 'usr-9', expectedVersion: 2 })),
    );

    expect(error.code).toBe(ERROR_CODE.CONFLICT);
    expect(error.message).toContain('Vui lòng tải lại');
  });

  it('should keep backend field errors for the create form', async () => {
    mockFetch(() =>
      jsonResponse(
        400,
        errorBody('VALIDATION_ERROR', 'Mã tài khoản không đúng định dạng.', {
          fields: [{ field: 'code', message: 'Mã tài khoản không đúng định dạng.' }],
        }),
      ),
    );

    const error = await captureAppError(executeApiCommand(createCommand(CREATE_PAYLOAD)));

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.fieldErrors).toEqual({ code: 'Mã tài khoản không đúng định dạng.' });
  });

  it('should refuse a create without a valid password before hitting the network', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));
    const error = await captureAppError(executeApiCommand(createCommand({ ...CREATE_PAYLOAD, password: '123' })));

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.fieldErrors?.password).toContain('8');
    expect(mock).not.toHaveBeenCalled();
  });

  it('should refuse an update without expectedVersion', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));
    const error = await captureAppError(executeApiCommand(createCommand({}, { action: 'updateUser', subjectId: 'usr-9' })));

    expect(error.code).toBe(ERROR_CODE.CONFLICT);
    expect(mock).not.toHaveBeenCalled();
  });

  it('should refuse an update without a subject id', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(USER_PROFILE)));
    const error = await captureAppError(executeApiCommand(createCommand({}, { action: 'updateUser', expectedVersion: 1 })));

    expect(error.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(mock).not.toHaveBeenCalled();
  });
});

const BUILDING_VIEW = {
  id: 'bld-9',
  code: 'T2C-E',
  name: 'Tòa T2C',
  address: '1 Lê Duẩn',
  isActive: true,
  version: 2,
};

const LOCATION_VIEW = {
  id: 'loc-9',
  buildingId: 'bld-9',
  floor: '5',
  zone: null,
  name: 'Phòng 501',
  isActive: true,
  version: 3,
};

describe('api command adapter — buildings and locations', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
    saveApiSession({ accessToken: 'tok-1', refreshToken: 'ref-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  it('should POST /buildings with the CreateBuildingDto and return the new subject id', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody(BUILDING_VIEW)));

    await expect(
      executeApiCommand(
        createCommand(
          { code: ' t2c-e ', name: ' Tòa T2C ', address: ' 1 Lê Duẩn ', templateKey: 'OFFICE' },
          { subjectType: 'BUILDING', action: 'createBuilding' },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'bld-9' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/buildings');
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toEqual({
      code: 'T2C-E',
      name: 'Tòa T2C',
      address: '1 Lê Duẩn',
      templateKey: 'OFFICE',
    });
  });

  it('should PATCH /buildings/:id with version = expectedVersion', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...BUILDING_VIEW, version: 3, name: 'Tòa T2C (sửa)' })));

    await expect(
      executeApiCommand(
        createCommand(
          { name: ' Tòa T2C (sửa) ', address: ' 1 Lê Duẩn ' },
          { subjectType: 'BUILDING', action: 'updateBuilding', subjectId: 'bld-9', expectedVersion: 2 },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'bld-9' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/buildings/bld-9');
    expect(init?.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ name: 'Tòa T2C (sửa)', address: '1 Lê Duẩn', version: 2 });
  });

  it('should POST /buildings/:id/locations and return the building plus the new location id', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody(LOCATION_VIEW)));

    await expect(
      executeApiCommand(
        createCommand(
          { floor: ' 5 ', zone: '', name: ' Phòng 501 ' },
          { subjectType: 'BUILDING', action: 'createLocation', subjectId: 'bld-9' },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'bld-9', data: { locationId: 'loc-9' } });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/buildings/bld-9/locations');
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toEqual({ floor: '5', name: 'Phòng 501', zone: null });
  });

  it('should PATCH /buildings/:id/locations/:locationId with version = expectedVersion', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...LOCATION_VIEW, version: 4, zone: 'Bắc' })));

    await expect(
      executeApiCommand(
        createCommand(
          { locationId: 'loc-9', floor: '5', zone: 'Bắc', name: 'Phòng 501' },
          { subjectType: 'BUILDING', action: 'updateLocation', subjectId: 'bld-9', expectedVersion: 3 },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'bld-9' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/buildings/bld-9/locations/loc-9');
    expect(init?.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ floor: '5', name: 'Phòng 501', zone: 'Bắc', version: 3 });
  });

  it('should PATCH /buildings/:id/locations/:locationId/status with the active flag and version', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody({ ...LOCATION_VIEW, isActive: false, version: 4 })));

    await expect(
      executeApiCommand(
        createCommand(
          { locationId: 'loc-9', active: false },
          { subjectType: 'BUILDING', action: 'setLocationActive', subjectId: 'bld-9', expectedVersion: 3 },
        ),
      ),
    ).resolves.toEqual({ ok: true, subjectId: 'bld-9' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/buildings/bld-9/locations/loc-9/status');
    expect(init?.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ active: false, version: 3 });
  });

  it('should refuse building/location writes without ids or expectedVersion before hitting the network', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody(LOCATION_VIEW)));

    const noBuilding = await captureAppError(
      executeApiCommand(createCommand({}, { subjectType: 'BUILDING', action: 'createLocation' })),
    );
    expect(noBuilding.code).toBe(ERROR_CODE.NOT_FOUND);

    const noLocation = await captureAppError(
      executeApiCommand(createCommand({}, { subjectType: 'BUILDING', action: 'updateLocation', subjectId: 'bld-9', expectedVersion: 1 })),
    );
    expect(noLocation.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(noLocation.message).toBe('Không tìm thấy vị trí.');

    const noVersion = await captureAppError(
      executeApiCommand(createCommand({ name: 'Tòa T2C', address: '1 Lê Duẩn' }, { subjectType: 'BUILDING', action: 'updateBuilding', subjectId: 'bld-9' })),
    );
    expect(noVersion.code).toBe(ERROR_CODE.CONFLICT);

    const noLocationVersion = await captureAppError(
      executeApiCommand(createCommand({ locationId: 'loc-9', active: true }, { subjectType: 'BUILDING', action: 'setLocationActive', subjectId: 'bld-9' })),
    );
    expect(noLocationVersion.code).toBe(ERROR_CODE.CONFLICT);
    expect(mock).not.toHaveBeenCalled();
  });

  it('should surface a duplicate location name as a field error under the name input', async () => {
    mockFetch(() =>
      jsonResponse(400, errorBody('VALIDATION_ERROR', 'Tầng này đã có vị trí cùng tên.', {
        fields: [{ field: 'name', message: 'Tầng này đã có vị trí cùng tên.' }],
      })),
    );

    const error = await captureAppError(
      executeApiCommand(
        createCommand(
          { floor: '5', name: 'Phòng 501' },
          { subjectType: 'BUILDING', action: 'createLocation', subjectId: 'bld-9' },
        ),
      ),
    );

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.fieldErrors).toEqual({ name: 'Tầng này đã có vị trí cùng tên.' });
  });
});
