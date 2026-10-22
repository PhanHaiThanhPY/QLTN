/**
 * Role → capability matrix. Mirrors web/src/domain/permissions.ts so the backend
 * enforces exactly what the UI shows; change both together.
 */

export const ROLE = {
  ADMIN: 'ADMIN',
  BQL: 'BQL',
  TECH_CONFIRMER: 'TECH_CONFIRMER',
  TECH_CONSULTANT: 'TECH_CONSULTANT',
  OWNERS_BOARD: 'OWNERS_BOARD',
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
export const ROLES = Object.values(ROLE);

export const ROLE_LABEL = {
  ADMIN: 'Quản trị hệ thống',
  BQL: 'Ban quản lý',
  TECH_CONFIRMER: 'Kỹ thuật',
  TECH_CONSULTANT: 'Tư vấn kỹ thuật (TVKT)',
  OWNERS_BOARD: 'Ban quản trị (BQT)',
} as const satisfies Record<Role, string>;

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
export const CAPABILITIES = Object.values(CAPABILITY);

/** ADMIN never holds business decision capabilities. */
const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
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
  // KT changes item condition only while confirming an occurrence.
  TECH_CONFIRMER: ['VIEW', 'RECORD_CONFIRM', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'MAINTENANCE_REVIEW'],
  // TVKT reviews the proposal first and accepts the construction together with KT.
  TECH_CONSULTANT: ['VIEW', 'PROPOSAL_DECIDE', 'ACCEPTANCE_DECIDE', 'REPORT_VIEW'],
  OWNERS_BOARD: ['VIEW', 'PROPOSAL_DECIDE', 'PAYMENT_DECIDE', 'REPORT_VIEW'],
};

export const isRole = (value: unknown): value is Role => typeof value === 'string' && ROLES.includes(value as Role);

/** Capabilities a system role grants; custom roles can only keep a subset of them. */
export const roleCapabilities = (role: Role): readonly Capability[] => ROLE_CAPABILITIES[role];

/**
 * Effective capabilities of an account: the role's set, narrowed by the custom
 * role's list when one is assigned (`null` = no custom role). A custom list can
 * never add a capability the system role lacks.
 */
export const effectiveCapabilities = (role: Role, customCapabilities: readonly string[] | null): Capability[] => {
  const granted = ROLE_CAPABILITIES[role];
  if (!customCapabilities) return [...granted];
  return granted.filter((capability) => customCapabilities.includes(capability));
};

export const canAccessBuilding = (user: { buildingIds: readonly string[] }, buildingId: string): boolean =>
  user.buildingIds.includes(buildingId);
