/**
 * Status groups used by the record list filter (`GET /records?statusGroup=`).
 * Mirrors web `REPAIR_STATUS_GROUP_BY_STATUS`; change both together.
 */
export const RECORD_STATUS_GROUPS = [
  'INTAKE',
  'NEEDS_ACTION',
  'APPROVAL',
  'CONSTRUCTION',
  'ACCEPTANCE',
  'PAYMENT',
  'COMPLETED',
  'CLOSED',
] as const;

export type RecordStatusGroup = (typeof RECORD_STATUS_GROUPS)[number];

export const RECORD_STATUS_GROUP_BY_STATUS: Readonly<Record<string, RecordStatusGroup>> = {
  DRAFT: 'INTAKE',
  PENDING_CONFIRMATION: 'INTAKE',
  NEEDS_RECORD_UPDATE: 'NEEDS_ACTION',
  PENDING_PROPOSAL: 'APPROVAL',
  EMERGENCY_IN_PROGRESS: 'CONSTRUCTION',
  PENDING_TECH_APPROVAL: 'APPROVAL',
  PENDING_TECH_REVIEW: 'APPROVAL',
  PENDING_BOARD_APPROVAL: 'APPROVAL',
  PENDING_CUSTOM_APPROVAL: 'APPROVAL',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'PAYMENT',
  NEEDS_SUBMISSION_UPDATE: 'NEEDS_ACTION',
  REJECTED_RESUBMITTABLE: 'NEEDS_ACTION',
  READY_FOR_CONSTRUCTION: 'CONSTRUCTION',
  IN_CONSTRUCTION: 'CONSTRUCTION',
  PENDING_ACCEPTANCE: 'ACCEPTANCE',
  NEEDS_REPAIR: 'NEEDS_ACTION',
  PENDING_PAYMENT_REQUEST: 'PAYMENT',
  PENDING_PAYMENT_APPROVAL: 'PAYMENT',
  NEEDS_PAYMENT_UPDATE: 'NEEDS_ACTION',
  PENDING_PAYMENT: 'PAYMENT',
  COMPLETED: 'COMPLETED',
  CLOSED_NO_REPAIR: 'CLOSED',
  UNRESOLVED: 'NEEDS_ACTION',
  CLOSED_WITHDRAWN: 'CLOSED',
};

export const statusesOfGroup = (group: RecordStatusGroup): string[] =>
  Object.entries(RECORD_STATUS_GROUP_BY_STATUS)
    .filter(([, value]) => value === group)
    .map(([status]) => status);

/** Final statuses (web `REPAIR_FINAL_STATUSES`); an "open" record is any status outside this list. */
export const RECORD_FINAL_STATUSES = ['COMPLETED', 'CLOSED_NO_REPAIR', 'UNRESOLVED', 'CLOSED_WITHDRAWN'] as const;

/** Statuses where the manager still has to supplement the record (card "cần bổ sung" and `attention=needs_update`). */
export const RECORD_NEEDS_UPDATE_STATUSES = [
  'NEEDS_RECORD_UPDATE',
  'NEEDS_SUBMISSION_UPDATE',
  'NEEDS_PAYMENT_UPDATE',
  'NEEDS_REPAIR',
  'UNRESOLVED',
] as const;
