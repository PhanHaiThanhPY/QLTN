import { IS_API_MODE } from '@/config/data-source';
import { forbidden, notFound } from '@/domain/errors';
import type { User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { fetchViewerProfile } from './http/auth-api';
import { getSessionUserId } from './runtime';

/**
 * Loads the signed-in user; every read service filters by this user's buildings.
 * In api mode the profile comes from `/auth/me` (cached in memory until sign-out).
 */
export const requireViewer = async (): Promise<User> => {
  if (IS_API_MODE) return fetchViewerProfile();
  const user = await getDb().users.get(getSessionUserId() ?? '');
  if (!user || !user.active) throw forbidden('Vui lòng chọn tài khoản demo.');
  return user;
};

/** Buildings the viewer may see, optionally narrowed by a filter value. */
export const scopedBuildingIds = (viewer: User, buildingId?: string): string[] => {
  if (!buildingId) return viewer.buildingIds;
  return viewer.buildingIds.includes(buildingId) ? [buildingId] : [];
};

/** Out-of-scope entities look exactly like missing ones (deep links to another building). */
export const assertInScope = <T extends { buildingId: string }>(viewer: User, entity: T | undefined): T => {
  if (!entity || !viewer.buildingIds.includes(entity.buildingId)) throw notFound();
  return entity;
};
