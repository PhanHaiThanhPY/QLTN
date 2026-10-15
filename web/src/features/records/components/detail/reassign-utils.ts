import { APPROVER_SLOTS, SLOT_ROLE, slotUserId } from '@/domain/permissions';
import type { AssigneeSlot } from '@/domain/permissions';
import type { RepairRecord, User } from '@/domain/types';

export type ReassignSlot = Exclude<AssigneeSlot, 'manager'>;

/** Slots BQL may reassign: the technical confirmer and every approver of the chain. */
export const REASSIGN_SLOTS: readonly ReassignSlot[] = ['confirmer', ...APPROVER_SLOTS];

/** Title-case slot names for headings and selects. */
export const SLOT_TITLE: Record<AssigneeSlot, string> = {
  manager: 'BQL quản lý',
  confirmer: 'Kỹ thuật xác nhận',
  consultant: 'TVKT thẩm định',
  board: 'BQT duyệt',
};

export const isReassignSlot = (slot: AssigneeSlot): slot is ReassignSlot => slot !== 'manager';

export const slotAssignee = (record: RepairRecord, slot: AssigneeSlot): string => slotUserId(record, slot) ?? '';

/** Active users of the same role and building, excluding the current assignee and the manager (spec 7). */
export const reassignCandidates = (users: User[], record: RepairRecord, slot: ReassignSlot): User[] =>
  users.filter(
    (user) =>
      user.active &&
      user.role === SLOT_ROLE[slot] &&
      user.buildingIds.includes(record.buildingId) &&
      user.id !== slotAssignee(record, slot) &&
      user.id !== record.managerUserId,
  );

export const NO_CANDIDATE_REASON = 'Không có người cùng vai trò trong tòa';
