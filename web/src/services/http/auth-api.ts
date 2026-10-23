import { AppError, ERROR_CODE } from '@/domain/errors';
import type { User } from '@/domain/types';
import { apiRequest } from './client';
import { mapUserProfile } from './mappers';
import type { ApiUserProfile } from './mappers';
import { saveApiSession, subscribeApiSession } from './token-store';

/** Login/refresh payload of api-qltn. */
interface ApiAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
  user?: ApiUserProfile;
}

/** In-memory only: the profile of the signed-in user (cleared on sign-out or expiry). */
let cachedViewer: User | null = null;

subscribeApiSession((session) => {
  if (!session) cachedViewer = null;
});

const requireTokens = (tokens: ApiAuthTokens): { accessToken: string; refreshToken: string } => {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new AppError(ERROR_CODE.NETWORK_ERROR, 'Máy chủ không trả về phiên đăng nhập hợp lệ.');
  }
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

/** Real sign-in: stores the token pair and returns the mapped profile. */
export const loginWithPassword = async (username: string, password: string): Promise<User> => {
  const tokens = await apiRequest<ApiAuthTokens>('POST', '/auth/login', {
    body: { username, password },
    anonymous: true,
  });
  const pair = requireTokens(tokens);
  if (!tokens.user) throw new AppError(ERROR_CODE.NETWORK_ERROR, 'Máy chủ không trả về hồ sơ tài khoản.');
  const viewer = mapUserProfile(tokens.user);
  saveApiSession(pair);
  cachedViewer = viewer;
  return viewer;
};

/** Profile of the signed-in user, cached until sign-out (the backend re-reads the account per request). */
export const fetchViewerProfile = async (): Promise<User> => {
  if (cachedViewer) return cachedViewer;
  const profile = await apiRequest<ApiUserProfile>('GET', '/auth/me');
  cachedViewer = mapUserProfile(profile);
  return cachedViewer;
};

export const clearViewerProfile = (): void => {
  cachedViewer = null;
};

/** Best-effort logout: revokes the refresh token server-side; the local session is already gone. */
export const logoutWithRefreshToken = async (refreshToken: string): Promise<void> => {
  if (!refreshToken) return;
  await apiRequest<{ loggedOut: true }>('POST', '/auth/logout', {
    body: { refreshToken },
    anonymous: true,
  });
};
