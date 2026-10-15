import type { Role } from './constants';
import type { User } from './types';

export const CAPABILITY = {
  VIEW: 'VIEW',
  RECORD_EDIT: 'RECORD_EDIT',
  RECORD_CONFIRM: 'RECORD_CONFIRM',
  PROPOSAL_DECIDE: 'PROPOSAL_DECIDE',
  CONSTRUCTION: 'CONSTRUCTION',
  ACCEPTANCE_DECIDE: 'ACCEPTANCE_DECIDE',
  PAYMENT_DECIDE: 'PAYMENT_DECIDE',
  PAYMENT_RECORD: 'PAYMENT_RECORD',
  MAINTENANCE_MANAGE: 'MAINTENANCE_MANAGE',
  MAINTENANCE_REVIEW: 'MAINTENANCE_REVIEW',
  ITEM_CONDITION: 'ITEM_CONDITION',
  REASSIGN: 'REASSIGN',
  REPLACE_MANAGER: 'REPLACE_MANAGER',
  REPORT_VIEW: 'REPORT_VIEW',
  ADMIN_VIEW: 'ADMIN_VIEW',
  /** Edit locations and configuration of the buildings in scope. */
  BUILDING_CONFIG: 'BUILDING_CONFIG',
  /** Manage accounts, custom roles, buildings and configuration templates. */
  ACCOUNT_MANAGE: 'ACCOUNT_MANAGE',
  /** Let work start before approval within the building's emergency limit. */
  EMERGENCY_START: 'EMERGENCY_START',
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/** Role matrix from spec section 3. ADMIN never holds business decision capabilities. */
const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: ['VIEW', 'REPLACE_MANAGER', 'REPORT_VIEW', 'ADMIN_VIEW', 'BUILDING_CONFIG', 'ACCOUNT_MANAGE'],
  BQL: [
    'VIEW',
    'RECORD_EDIT',
    'CONSTRUCTION',
    'PAYMENT_RECORD',
    'MAINTENANCE_MANAGE',
    'ITEM_CONDITION',
    'REASSIGN',
    'REPORT_VIEW',
    'BUILDING_CONFIG',
    'EMERGENCY_START',
  ],
  // KT changes item condition only while confirming an occurrence (spec section 3).
  TECH_CONFIRMER: ['VIEW', 'RECORD_CONFIRM', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'MAINTENANCE_REVIEW'],
  // TVKT reviews the proposal first and accepts the construction together with KT.
  TECH_CONSULTANT: ['VIEW', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'REPORT_VIEW'],
  OWNERS_BOARD: ['VIEW', 'PROPOSAL_DECIDE', 'PAYMENT_DECIDE', 'REPORT_VIEW'],
};

/** Capabilities a system role grants; custom roles can only keep a subset of them. */
export const roleCapabilities = (role: Role): readonly Capability[] => ROLE_CAPABILITIES[role];

export const hasCapability = (user: Pick<User, 'role' | 'active' | 'capabilities'>, capability: Capability): boolean =>
  user.active && ROLE_CAPABILITIES[user.role].includes(capability) && (!user.capabilities || user.capabilities.includes(capability));

export const canAccessBuilding = (user: Pick<User, 'buildingIds' | 'active'>, buildingId: string): boolean =>
  user.active && user.buildingIds.includes(buildingId);

/** A missing location scope means the user can work anywhere inside assigned buildings. */
export const canAccessLocation = (
  user: Pick<User, 'buildingIds' | 'locationIds' | 'active'>,
  buildingId: string,
  locationId?: string,
): boolean => {
  if (!canAccessBuilding(user, buildingId)) return false;
  return !locationId || !user.locationIds || user.locationIds.length === 0 || user.locationIds.includes(locationId);
};

/** Assignee slot on a subject that a step belongs to. */
export type AssigneeSlot = 'manager' | 'confirmer' | 'consultant' | 'board';

/** Slots that only exist on repair records (the approval chain). */
export const APPROVER_SLOTS = ['consultant', 'board'] as const satisfies readonly AssigneeSlot[];
export type ApproverSlot = (typeof APPROVER_SLOTS)[number];

export const ASSIGNEE_SLOT_LABEL: Record<AssigneeSlot, string> = {
  manager: 'BQL quản lý',
  confirmer: 'kỹ thuật xác nhận',
  consultant: 'TVKT',
  board: 'BQT',
};

export const SLOT_ROLE: Record<AssigneeSlot, Role> = {
  manager: 'BQL',
  confirmer: 'TECH_CONFIRMER',
  consultant: 'TECH_CONSULTANT',
  board: 'OWNERS_BOARD',
};

export interface AssignedSubject {
  buildingId: string;
  locationId?: string;
  managerUserId: string;
  confirmationUserId: string;
  consultantUserId?: string;
  boardUserId?: string;
}

/** Field on the subject that stores each slot's assignee. */
export const SLOT_FIELD = {
  manager: 'managerUserId',
  confirmer: 'confirmationUserId',
  consultant: 'consultantUserId',
  board: 'boardUserId',
} as const satisfies Record<AssigneeSlot, keyof AssignedSubject>;

export const slotUserId = (subject: AssignedSubject, slot: AssigneeSlot): string | undefined => subject[SLOT_FIELD[slot]];

const joinSlotLabels = (slots: readonly AssigneeSlot[]): string => slots.map((slot) => ASSIGNEE_SLOT_LABEL[slot]).join(' hoặc ');

/**
 * Returns a Vietnamese reason when the user may not perform a step, or null when allowed.
 * Checks building scope, role capability and personal assignment (spec section 3).
 * `slots` = null means any user holding the capability inside the building; an empty list means nobody.
 */
export const denyReason = (
  user: User,
  subject: AssignedSubject,
  capability: Capability,
  slots: AssigneeSlot | readonly AssigneeSlot[] | null,
): string | null => {
  if (!user.active) return 'Tài khoản đã ngừng hoạt động.';
  if (!canAccessBuilding(user, subject.buildingId)) return 'Ngoài phạm vi tòa nhà của bạn.';
  if (subject.locationId && !canAccessLocation(user, subject.buildingId, subject.locationId)) return 'Ngoài phạm vi khu vực của bạn.';
  if (!hasCapability(user, capability)) return 'Vai trò của bạn không có quyền thao tác này.';
  if (slots === null) return null;
  const list: readonly AssigneeSlot[] = typeof slots === 'string' ? [slots] : slots;
  if (list.length === 0) return 'Bước này không còn chờ bạn xử lý.';
  if (!list.some((slot) => slotUserId(subject, slot) === user.id)) {
    return `Chỉ ${joinSlotLabels(list)} được giao mới thực hiện được bước này.`;
  }
  return null;
};
