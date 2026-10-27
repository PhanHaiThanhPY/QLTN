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
  /** Prepare payment requests and close the record (BQL). */
  PAYMENT_RECORD: 'PAYMENT_RECORD',
  /** Confirm that a payment instalment was transferred, with its proof (BQT or Kế toán, DF-08). */
  PAYMENT_CONFIRM: 'PAYMENT_CONFIRM',
  /** Money operations of the operating fund (F06–F09) and maintenance-fund deposits (T03–T06); reserved. */
  FUND_OPERATE: 'FUND_OPERATE',
  MAINTENANCE_MANAGE: 'MAINTENANCE_MANAGE',
  MAINTENANCE_REVIEW: 'MAINTENANCE_REVIEW',
  ITEM_CONDITION: 'ITEM_CONDITION',
  REASSIGN: 'REASSIGN',
  REPLACE_MANAGER: 'REPLACE_MANAGER',
  REPORT_VIEW: 'REPORT_VIEW',
  ADMIN_VIEW: 'ADMIN_VIEW',
  /** Edit the building configuration (workflow, limits, assignment rules) and read its history; ADMIN only (DF-11). */
  BUILDING_CONFIG: 'BUILDING_CONFIG',
  /** Manage floors, areas and locations of the buildings in scope. */
  LOCATION_MANAGE: 'LOCATION_MANAGE',
  /** Manage accounts, custom roles, buildings and configuration templates. */
  ACCOUNT_MANAGE: 'ACCOUNT_MANAGE',
  /** Let work start before approval within the building's emergency limit. */
  EMERGENCY_START: 'EMERGENCY_START',
  /** Read the operation log of the buildings in scope (AD-S1 BR-01); system-wide rows stay ADMIN only. */
  AUDIT_VIEW: 'AUDIT_VIEW',
  /** See exploitation packages, partners, bids with their offered prices and documents (F-S1 BR-F1-11). */
  EXPLOITATION_VIEW: 'EXPLOITATION_VIEW',
  /** Create and issue packages, record bids, request supplements, close and cancel (F-S1 BR-F1-11). */
  EXPLOITATION_MANAGE: 'EXPLOITATION_MANAGE',
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/**
 * Matrix v2 (ADR-0001 §3). ADMIN never holds business decision capabilities; only ADMIN edits the building
 * configuration (DF-11) while BQL keeps the locations.
 */
const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: [
    'VIEW',
    'REPLACE_MANAGER',
    'REPORT_VIEW',
    'ADMIN_VIEW',
    'BUILDING_CONFIG',
    'LOCATION_MANAGE',
    'ACCOUNT_MANAGE',
    'AUDIT_VIEW',
  ],
  BQL: [
    'VIEW',
    'RECORD_EDIT',
    'CONSTRUCTION',
    'ACCEPTANCE_DECIDE',
    'PAYMENT_RECORD',
    'MAINTENANCE_MANAGE',
    'ITEM_CONDITION',
    'REASSIGN',
    'REPORT_VIEW',
    'LOCATION_MANAGE',
    'EMERGENCY_START',
    'AUDIT_VIEW',
    'EXPLOITATION_VIEW',
    'EXPLOITATION_MANAGE',
  ],
  // KT changes item condition only while confirming an occurrence.
  TECH_CONFIRMER: ['VIEW', 'RECORD_CONFIRM', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'MAINTENANCE_REVIEW'],
  // TVKT confirms the site condition (DF-01), reviews the proposal and takes part in the acceptance (DF-06).
  TECH_CONSULTANT: ['VIEW', 'RECORD_CONFIRM', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'REPORT_VIEW'],
  // BQT is the confirmer fallback (DF-01), approves, accepts (DF-06) and may confirm transfers (DF-08).
  OWNERS_BOARD: [
    'VIEW',
    'RECORD_CONFIRM',
    'PROPOSAL_DECIDE',
    'ACCEPTANCE_DECIDE',
    'PAYMENT_DECIDE',
    'PAYMENT_CONFIRM',
    'REPORT_VIEW',
    'AUDIT_VIEW',
    'EXPLOITATION_VIEW',
  ],
  // Kế toán on the BQT side: confirms transfers and runs fund money operations (DF-10).
  ACCOUNTANT: ['VIEW', 'PAYMENT_CONFIRM', 'FUND_OPERATE', 'REPORT_VIEW'],
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
