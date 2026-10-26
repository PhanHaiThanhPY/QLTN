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
  ACCOUNTANT: 'ACCOUNTANT',
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
export const ROLES = Object.values(ROLE);

export const ROLE_LABEL = {
  ADMIN: 'Quản trị hệ thống',
  BQL: 'Ban quản lý',
  TECH_CONFIRMER: 'Kỹ thuật',
  TECH_CONSULTANT: 'Tư vấn kỹ thuật (TVKT)',
  OWNERS_BOARD: 'Ban quản trị (BQT)',
  ACCOUNTANT: 'Kế toán',
} as const satisfies Record<Role, string>;

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
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
export const CAPABILITIES = Object.values(CAPABILITY);

/**
 * Matrix v2 (ADR-0001 §3). ADMIN never holds business decision capabilities; only ADMIN edits the building
 * configuration (DF-11) while BQL keeps the locations.
 */
const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
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
  ],
  // Kế toán on the BQT side: confirms transfers and runs fund money operations (DF-10).
  ACCOUNTANT: ['VIEW', 'PAYMENT_CONFIRM', 'FUND_OPERATE', 'REPORT_VIEW'],
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
