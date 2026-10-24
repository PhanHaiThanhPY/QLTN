import { API_BASE_URL } from '@/config/data-source';
import { AppError, ERROR_CODE } from '@/domain/errors';
import type { FieldErrors } from '@/domain/errors';
import { clearApiSession, readApiSession, saveApiSession } from './token-store';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  body?: unknown;
  /** Multipart request; the browser sets the boundary, so no Content-Type header is written. */
  form?: FormData;
  query?: Readonly<Record<string, QueryValue>>;
  /** Public endpoint (login/refresh/logout): no bearer header, and a 401 never triggers a refresh. */
  anonymous?: boolean;
}

/** Standard list metadata from api-qltn. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResult<T> {
  data: T[];
  meta?: PageMeta;
}

const CONFLICT_MESSAGE = 'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại trước khi thao tác.';
const FORBIDDEN_MESSAGE = 'Bạn không có quyền thực hiện thao tác này.';
const NOT_FOUND_MESSAGE = 'Không tìm thấy dữ liệu yêu cầu.';
const UNAUTHORIZED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
const VALIDATION_MESSAGE = 'Dữ liệu chưa hợp lệ.';
const NETWORK_MESSAGE = 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
const INVALID_PAYLOAD_MESSAGE = 'Phản hồi từ máy chủ không đúng định dạng.';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorEnvelope = (body: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(body) || !isRecord(body.error)) return undefined;
  return body.error;
};

const messageOf = (body: unknown, fallback: string): string => {
  const message = errorEnvelope(body)?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

/** `error.details.fields` is `[{ field, message }]` (see api-qltn/src/common/validation). */
const fieldErrorsOf = (body: unknown): FieldErrors | undefined => {
  const details = errorEnvelope(body)?.details;
  if (!isRecord(details) || !Array.isArray(details.fields)) return undefined;
  const fieldErrors: FieldErrors = {};
  for (const row of details.fields) {
    if (!isRecord(row)) continue;
    const field = typeof row.field === 'string' ? row.field : '';
    const message = typeof row.message === 'string' ? row.message : '';
    if (field && message && !fieldErrors[field]) fieldErrors[field] = message;
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
};

const codeOf = (body: unknown): string | undefined => {
  const code = errorEnvelope(body)?.code;
  return typeof code === 'string' ? code : undefined;
};

/** Business refusals carry `details.reason` (snake_case); screens give it a dedicated message. */
const reasonOf = (body: unknown): string | undefined => {
  const details = errorEnvelope(body)?.details;
  if (!isRecord(details)) return undefined;
  const reason = details.reason;
  return typeof reason === 'string' ? reason : undefined;
};

/**
 * Maps an api-qltn error response onto the web `AppError` contract.
 * The backend Vietnamese message always wins when present.
 */
export const mapApiError = (status: number, body: unknown): AppError => {
  const fieldErrors = fieldErrorsOf(body);
  if (status === 409 && reasonOf(body) === 'invalid_status_transition') {
    return new AppError(ERROR_CODE.INVALID_TRANSITION, messageOf(body, CONFLICT_MESSAGE));
  }
  if (status === 409) return new AppError(ERROR_CODE.CONFLICT, messageOf(body, CONFLICT_MESSAGE));
  if (status === 403) return new AppError(ERROR_CODE.FORBIDDEN, messageOf(body, FORBIDDEN_MESSAGE));
  if (status === 404) return new AppError(ERROR_CODE.NOT_FOUND, messageOf(body, NOT_FOUND_MESSAGE));
  if (status === 401) return new AppError(ERROR_CODE.UNAUTHORIZED, messageOf(body, UNAUTHORIZED_MESSAGE));
  if (status === 400 || status === 422 || codeOf(body) === ERROR_CODE.VALIDATION_ERROR) {
    const message = messageOf(body, fieldErrors ? Object.values(fieldErrors)[0] : VALIDATION_MESSAGE);
    return new AppError(ERROR_CODE.VALIDATION_ERROR, message, fieldErrors);
  }
  if (status === 429) return new AppError(ERROR_CODE.NETWORK_ERROR, messageOf(body, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'));
  return new AppError(ERROR_CODE.NETWORK_ERROR, messageOf(body, NETWORK_MESSAGE));
};

const buildUrl = (path: string, query: RequestOptions['query']): string => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
};

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.error('Invalid JSON response:', error);
    return text;
  }
};

interface RawResponse {
  status: number;
  body: unknown;
}

const request = async (
  method: HttpMethod,
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<RawResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const init: RequestInit = { method, headers };
  if (options.form) init.body = options.form;
  else if (options.body !== undefined) init.body = JSON.stringify(options.body);
  try {
    const response = await fetch(buildUrl(path, options.query), init);
    return { status: response.status, body: await readBody(response) };
  } catch (error) {
    console.error('API request failed:', error);
    throw new AppError(ERROR_CODE.NETWORK_ERROR, NETWORK_MESSAGE);
  }
};

/** Envelope `{ success: true, data }` → `data`; anything else is an error. */
const unwrap = (body: unknown, status: number): unknown => {
  if (status >= 200 && status < 300 && body === null) return null;
  if (isRecord(body) && body.success !== false && 'data' in body) return body.data;
  if (isRecord(body) && body.success === false) throw mapApiError(status, body);
  throw new AppError(ERROR_CODE.NETWORK_ERROR, INVALID_PAYLOAD_MESSAGE);
};

const saveRefreshedTokens = (body: unknown): string => {
  const data = unwrap(body, 200);
  if (!isRecord(data)) throw new AppError(ERROR_CODE.NETWORK_ERROR, INVALID_PAYLOAD_MESSAGE);
  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : '';
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : '';
  if (!accessToken || !refreshToken) throw new AppError(ERROR_CODE.NETWORK_ERROR, INVALID_PAYLOAD_MESSAGE);
  saveApiSession({ accessToken, refreshToken });
  return accessToken;
};

const performRefresh = async (): Promise<string> => {
  const session = readApiSession();
  if (!session) {
    clearApiSession();
    throw new AppError(ERROR_CODE.UNAUTHORIZED, UNAUTHORIZED_MESSAGE);
  }
  try {
    const response = await request('POST', '/auth/refresh', {
      body: { refreshToken: session.refreshToken },
      anonymous: true,
    }, null);
    if (response.status < 200 || response.status >= 300) throw mapApiError(response.status, response.body);
    return saveRefreshedTokens(response.body);
  } catch (error) {
    // A broken refresh must not leave a half-signed-in UI behind.
    clearApiSession();
    throw error;
  }
};

/** Several requests hitting 401 at once share one refresh call. */
let refreshInFlight: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const send = async (
  method: HttpMethod,
  path: string,
  options: RequestOptions,
  canRefresh: boolean,
): Promise<unknown> => {
  const accessToken = options.anonymous ? null : (readApiSession()?.accessToken ?? null);
  const response = await request(method, path, options, accessToken);
  if (response.status >= 200 && response.status < 300) return unwrap(response.body, response.status);
  if (response.status === 401 && canRefresh && !options.anonymous) {
    const refreshedToken = await refreshAccessToken();
    const retried = await request(method, path, options, refreshedToken);
    if (retried.status >= 200 && retried.status < 300) return unwrap(retried.body, retried.status);
    throw mapApiError(retried.status, retried.body);
  }
  throw mapApiError(response.status, response.body);
};

/**
 * Calls api-qltn and returns the unwrapped `data` payload.
 * A 401 refreshes the token once (shared by all concurrent callers) and retries the request.
 */
export const apiRequest = async <T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> => {
  const data = await send(method, path, options, true);
  return data as T;
};

const readMeta = (value: unknown): PageMeta | undefined => {
  if (!isRecord(value)) return undefined;
  const { page, limit, total, totalPages } = value;
  if (typeof page !== 'number' || typeof limit !== 'number') return undefined;
  if (typeof total !== 'number' || typeof totalPages !== 'number') return undefined;
  return { page, limit, total, totalPages };
};

/** Paginated call: keeps `meta` for pagers, still returns the plain array in `data`. */
export const apiList = async <T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ListResult<T>> => {
  const data = await send(method, path, options, true);
  if (isRecord(data) && Array.isArray(data.data)) {
    return { data: data.data as T[], meta: readMeta(data.meta) };
  }
  if (Array.isArray(data)) return { data: data as T[] };
  throw new AppError(ERROR_CODE.NETWORK_ERROR, INVALID_PAYLOAD_MESSAGE);
};

const fetchBlob = async (path: string, accessToken: string | null): Promise<Response> => {
  const headers: Record<string, string> = { Accept: '*/*' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, undefined), { method: 'GET', headers });
  } catch (error) {
    console.error('API request failed:', error);
    throw new AppError(ERROR_CODE.NETWORK_ERROR, NETWORK_MESSAGE);
  }
};

/**
 * Fetches a file and returns its bytes. Shares the JSON path's token refresh: a 401 refreshes
 * once and retries, so an expired session does not surface as a broken image.
 */
export const apiRequestBlob = async (path: string): Promise<Blob> => {
  let response = await fetchBlob(path, readApiSession()?.accessToken ?? null);
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    response = await fetchBlob(path, refreshedToken);
  }
  if (response.status >= 200 && response.status < 300) return response.blob();
  throw mapApiError(response.status, await readBody(response));
};
