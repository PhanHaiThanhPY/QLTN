// @vitest-environment jsdom
import { AppError, ERROR_CODE, isAppError } from '@/domain/errors';
import type { FieldErrors } from '@/domain/errors';
import { apiList, apiRequest, apiRequestBlob } from './client';
import { clearApiSession, readApiSession, saveApiSession, subscribeApiSession } from './token-store';

const jsonResponse = (status: number, body: unknown): Response =>
  ({ status, text: async () => (body === null ? '' : JSON.stringify(body)) }) as unknown as Response;

const successBody = (data: unknown): unknown => ({ success: true, data, timestamp: '2026-01-01T00:00:00.000Z', correlationId: null });

const errorBody = (code: string, message: string, details: unknown = null): unknown => ({
  success: false,
  error: { code, message, details },
  timestamp: '2026-01-01T00:00:00.000Z',
  correlationId: null,
});

const UNAUTHORIZED_BODY = errorBody('UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');

const mockFetch = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);
  return mock;
};

const headerOf = (init: RequestInit | undefined, name: string): string | undefined =>
  (init?.headers as Record<string, string> | undefined)?.[name];

const captureAppError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error('Expected the request to reject with an AppError.');
};

describe('http client', () => {
  beforeEach(() => {
    clearApiSession();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearApiSession();
  });

  it('should unwrap the { success, data } envelope and attach the stored bearer token', async () => {
    saveApiSession({ accessToken: 'tok-1', refreshToken: 'ref-1' });
    const mock = mockFetch(() => jsonResponse(200, successBody({ id: 'b1' })));

    await expect(apiRequest('GET', '/buildings/b1')).resolves.toEqual({ id: 'b1' });

    expect(String(mock.mock.calls[0][0])).toBe('/api/buildings/b1');
    expect(headerOf(mock.mock.calls[0][1], 'Authorization')).toBe('Bearer tok-1');
    expect(headerOf(mock.mock.calls[0][1], 'Accept')).toBe('application/json');
  });

  it('should not send a bearer token on anonymous endpoints', async () => {
    saveApiSession({ accessToken: 'tok-1', refreshToken: 'ref-1' });
    const mock = mockFetch(() => jsonResponse(200, successBody({ id: 'u1' })));

    await apiRequest('POST', '/auth/login', { body: { username: 'admin-demo', password: 'x' }, anonymous: true });

    expect(headerOf(mock.mock.calls[0][1], 'Authorization')).toBeUndefined();
    expect(mock.mock.calls[0][1].body).toBe(JSON.stringify({ username: 'admin-demo', password: 'x' }));
  });

  it('should serialise query parameters and skip empty ones', async () => {
    const mock = mockFetch(() => jsonResponse(200, successBody([])));

    await apiRequest('GET', '/users', { query: { page: 1, active: true, q: '', missing: undefined } });

    expect(String(mock.mock.calls[0][0])).toBe('/api/users?page=1&active=true');
  });

  it('should map a 422 validation error to fieldErrors from details.fields', async () => {
    mockFetch(() =>
      jsonResponse(
        422,
        errorBody('VALIDATION_ERROR', 'Tên nhân viên không được để trống.', {
          fields: [
            { field: 'fullName', message: 'Tên nhân viên không được để trống.' },
            { field: 'email', message: 'Email không đúng định dạng email.' },
          ],
        }),
      ),
    );

    const error = await captureAppError(apiRequest('POST', '/users', { body: {} }));

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(error.message).toBe('Tên nhân viên không được để trống.');
    expect(error.fieldErrors).toEqual({ fullName: 'Tên nhân viên không được để trống.', email: 'Email không đúng định dạng email.' } satisfies FieldErrors);
  });

  it('should keep one message per field when an older backend sends several for the same field', async () => {
    mockFetch(() =>
      jsonResponse(
        400,
        errorBody('VALIDATION_ERROR', 'Mật khẩu quá dài.', {
          fields: [
            { field: 'password', message: 'Mật khẩu quá dài.' },
            { field: 'password', message: 'Mật khẩu không được để trống.' },
            { field: 'username', message: 'Tên đăng nhập là bắt buộc.' },
          ],
        }),
      ),
    );

    const error = await captureAppError(apiRequest('POST', '/auth/login', { body: {} }));

    expect(error.fieldErrors).toEqual({
      password: 'Mật khẩu quá dài.',
      username: 'Tên đăng nhập là bắt buộc.',
    } satisfies FieldErrors);
  });

  it('should map 409, 403 and 404 to their AppError codes and keep the Vietnamese message', async () => {
    const cases: { status: number; code: string; message: string; expected: string }[] = [
      { status: 409, code: 'CONFLICT', message: 'Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.', expected: ERROR_CODE.CONFLICT },
      { status: 403, code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.', expected: ERROR_CODE.FORBIDDEN },
      { status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu yêu cầu.', expected: ERROR_CODE.NOT_FOUND },
    ];

    for (const testCase of cases) {
      mockFetch(() => jsonResponse(testCase.status, errorBody(testCase.code, testCase.message)));
      const error = await captureAppError(apiRequest('GET', '/buildings/b1'));
      expect(error.code).toBe(testCase.expected);
      expect(error.message).toBe(testCase.message);
      vi.unstubAllGlobals();
    }
  });

  it('should map a network failure and a 5xx answer to NETWORK_ERROR', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const offline = await captureAppError(apiRequest('GET', '/users'));
    expect(offline.code).toBe(ERROR_CODE.NETWORK_ERROR);

    mockFetch(() => jsonResponse(500, errorBody('INTERNAL_SERVER_ERROR', 'Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.')));
    const server = await captureAppError(apiRequest('GET', '/users'));
    expect(server.code).toBe(ERROR_CODE.NETWORK_ERROR);
    expect(server.message).toBe('Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.');
  });

  it('should map a 429 answer to RATE_LIMITED so screens can tell it from a network failure', async () => {
    mockFetch(() => jsonResponse(429, errorBody('TOO_MANY_REQUESTS', 'Quá nhiều yêu cầu.')));

    const error = await captureAppError(apiRequest('POST', '/auth/change-password', { body: {} }));

    expect(error.code).toBe(ERROR_CODE.RATE_LIMITED);
  });

  it('should report a malformed payload as NETWORK_ERROR instead of swallowing it', async () => {
    mockFetch(() => jsonResponse(200, { unexpected: true }));

    const error = await captureAppError(apiRequest('GET', '/users'));

    expect(error.code).toBe(ERROR_CODE.NETWORK_ERROR);
  });

  it('should refresh once on 401, retry the request with the new token and keep the rotated refresh token', async () => {
    saveApiSession({ accessToken: 'old-token', refreshToken: 'ref-1' });
    const urls: string[] = [];
    const mock = mockFetch((url, init) => {
      urls.push(url);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, successBody({ accessToken: 'new-token', refreshToken: 'ref-2', tokenType: 'Bearer' }));
      }
      if (headerOf(init, 'Authorization') === 'Bearer new-token') return jsonResponse(200, successBody({ id: 'u1' }));
      return jsonResponse(401, UNAUTHORIZED_BODY);
    });

    await expect(apiRequest('GET', '/auth/me')).resolves.toEqual({ id: 'u1' });

    expect(urls).toEqual(['/api/auth/me', '/api/auth/refresh', '/api/auth/me']);
    expect(mock.mock.calls[1][1].body).toBe(JSON.stringify({ refreshToken: 'ref-1' }));
    expect(readApiSession()).toEqual({ accessToken: 'new-token', refreshToken: 'ref-2' });
  });

  it('should share a single refresh between concurrent 401 answers', async () => {
    saveApiSession({ accessToken: 'old-token', refreshToken: 'ref-1' });
    let refreshCount = 0;
    let unauthorizedCount = 0;
    let releaseRefresh = (): void => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    mockFetch(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        await refreshGate;
        return jsonResponse(200, successBody({ accessToken: 'new-token', refreshToken: 'ref-2' }));
      }
      if (headerOf(init, 'Authorization') === 'Bearer new-token') return jsonResponse(200, successBody({ ok: true }));
      unauthorizedCount += 1;
      return jsonResponse(401, UNAUTHORIZED_BODY);
    });

    const requests = [apiRequest('GET', '/users'), apiRequest('GET', '/buildings')];
    await vi.waitFor(() => expect(unauthorizedCount).toBe(2));
    releaseRefresh();
    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(refreshCount).toBe(1);
    expect(readApiSession()).toEqual({ accessToken: 'new-token', refreshToken: 'ref-2' });
  });

  it('should drop the session and report UNAUTHORIZED when the refresh fails', async () => {
    saveApiSession({ accessToken: 'old-token', refreshToken: 'ref-1' });
    const onSessionChange = vi.fn();
    const unsubscribe = subscribeApiSession(onSessionChange);
    mockFetch((url) =>
      url.endsWith('/auth/refresh')
        ? jsonResponse(401, errorBody('INVALID_REFRESH_TOKEN', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'))
        : jsonResponse(401, UNAUTHORIZED_BODY),
    );

    const error = await captureAppError(apiRequest('GET', '/auth/me'));

    expect(error.code).toBe(ERROR_CODE.UNAUTHORIZED);
    expect(error.message).toBe('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    expect(readApiSession()).toBeNull();
    expect(onSessionChange).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });

  it('should never refresh an anonymous 401 (wrong credentials on login)', async () => {
    const mock = mockFetch(() =>
      jsonResponse(401, errorBody('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.')),
    );

    const error = await captureAppError(
      apiRequest('POST', '/auth/login', { body: { username: 'admin-demo', password: 'sai' }, anonymous: true }),
    );

    expect(error.code).toBe(ERROR_CODE.UNAUTHORIZED);
    expect(error.message).toBe('Tên đăng nhập hoặc mật khẩu không đúng.');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('should return data with meta for paginated lists', async () => {
    mockFetch(() =>
      jsonResponse(200, successBody({ data: [{ id: '1' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })),
    );

    await expect(apiList('GET', '/users')).resolves.toEqual({
      data: [{ id: '1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('should send FormData as-is without forcing a JSON content type', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody({ id: 'att-1' })));
    const form = new FormData();
    form.append('subjectType', 'REPAIR_RECORD');
    form.append('file', new Blob(['png'], { type: 'image/png' }), 'anh.png');

    await expect(apiRequest('POST', '/attachments', { form })).resolves.toEqual({ id: 'att-1' });

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/attachments');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(form);
    expect(headerOf(init, 'Content-Type')).toBeUndefined();
  });

  it('should return the Blob of a file response', async () => {
    const blob = new Blob(['noi dung'], { type: 'image/png' });
    mockFetch(
      () =>
        ({
          status: 200,
          blob: async () => blob,
          headers: { get: () => 'image/png' },
        }) as unknown as Response,
    );

    await expect(apiRequestBlob('/attachments/att-1/content')).resolves.toBe(blob);
  });

  it('should map a missing file (404) onto NOT_FOUND', async () => {
    mockFetch(() => jsonResponse(404, errorBody('NOT_FOUND', 'Không tìm thấy tệp hoặc tệp ngoài phạm vi.')));

    const error = await captureAppError(apiRequestBlob('/attachments/att-x/content'));

    expect(error.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(error.message).toBe('Không tìm thấy tệp hoặc tệp ngoài phạm vi.');
  });
});
