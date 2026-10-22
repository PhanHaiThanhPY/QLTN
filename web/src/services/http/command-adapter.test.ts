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

describe('api command adapter', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  it('should register only the actions wired in T2a', () => {
    expect(isApiAction('createUser')).toBe(true);
    expect(isApiAction('updateUser')).toBe(true);
    expect(isApiAction('createDepartment')).toBe(false);
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
    const error = await captureAppError(executeApiCommand(createCommand({}, { action: 'createDepartment' })));

    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.message).toBe('Thao tác này chưa nối API.');
    expect(mock).not.toHaveBeenCalled();
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
