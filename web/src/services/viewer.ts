import { forbidden, notFound } from '@/domain/errors';
import type { User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { getSessionUserId } from './runtime';

/** Loads the demo session user; every read service filters by this user's buildings. */
export const requireViewer = async (): Promise<User> => {
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
