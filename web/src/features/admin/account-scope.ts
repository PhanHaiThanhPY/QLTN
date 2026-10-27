import type { User } from '@/domain/types';

/**
 * FX-S1 BR-FX1-04: an account with a building outside the viewer's scope is read-only for that viewer (the API
 * refuses the write with 403 account_scope_exceeded).
 */
export const isOutsideViewerScope = (account: Pick<User, 'buildingIds'>, viewer: Pick<User, 'buildingIds'> | undefined): boolean =>
  Boolean(viewer && account.buildingIds.some((id) => !viewer.buildingIds.includes(id)));
