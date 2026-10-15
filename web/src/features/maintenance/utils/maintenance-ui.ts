import type { ActionState } from '@/domain/actions';
import type { Capability } from '@/domain/permissions';
import { denyReason } from '@/domain/permissions';
import type { Role } from '@/domain/constants';
import type { User } from '@/domain/types';

/** Action state for building-level commands without an assignee slot (items, refresh schedule). */
export const capabilityState = (viewer: User | undefined, capability: Capability, buildingId: string): ActionState => {
  if (!viewer) return { allowed: false, reason: 'Đang tải tài khoản.' };
  const reason = denyReason(viewer, { buildingId, managerUserId: '', confirmationUserId: '' }, capability, null);
  return reason ? { allowed: false, reason } : { allowed: true };
};

/** Active users of a role inside a building, for assignee selects. */
export const activeUsersInRole = (users: User[] | undefined, role: Role, buildingId: string | undefined): User[] =>
  (users ?? []).filter((user) => user.active && user.role === role && Boolean(buildingId) && user.buildingIds.includes(buildingId ?? ''));

export const userOptionLabel = (user: User): string => `${user.fullName} (${user.code})`;

/** First and last day (YYYY-MM-DD) of a month given as YYYY-MM. */
export const monthRange = (month: string): { from: string; to: string } => {
  const [year, monthNo] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};

export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNo] = month.split('-').map(Number);
  const value = new Date(Date.UTC(year, monthNo - 1 + delta, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (month: string): string => {
  const [year, monthNo] = month.split('-');
  return `Tháng ${Number(monthNo)}/${year}`;
};
