import { notFound } from '../errors';
import type { AuthenticatedUser } from './authenticated-user';

/** Out-of-scope buildings answer 404, so their existence is not revealed. */
export function assertBuildingInScope(user: AuthenticatedUser, buildingId: string): void {
  if (!user.buildingIds.includes(buildingId)) throw notFound('Không tìm thấy tòa nhà trong phạm vi của bạn.');
}

export const hasCapability = (user: AuthenticatedUser, capability: AuthenticatedUser['capabilities'][number]) =>
  user.capabilities.includes(capability);
