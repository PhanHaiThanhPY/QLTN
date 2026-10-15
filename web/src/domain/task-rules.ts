import type { OccurrenceStatus, RepairStatus, TaskKind } from './constants';
import { APPROVER_SLOTS, SLOT_ROLE, canAccessLocation, hasCapability, slotUserId } from './permissions';
import type { AssignedSubject, AssigneeSlot, Capability } from './permissions';
import type { MaintenanceOccurrence, RepairRecord, User } from './types';

interface TaskTarget {
  kind: TaskKind;
  slot: AssigneeSlot;
}

const REPAIR_TASK: Partial<Record<RepairStatus, TaskTarget>> = {
  PENDING_CONFIRMATION: { kind: 'CONFIRM_RECORD', slot: 'confirmer' },
  NEEDS_RECORD_UPDATE: { kind: 'UPDATE_RECORD', slot: 'manager' },
  PENDING_PROPOSAL: { kind: 'PREPARE_PROPOSAL', slot: 'manager' },
  EMERGENCY_IN_PROGRESS: { kind: 'SUBMIT_EMERGENCY_DOCS', slot: 'manager' },
  PENDING_TECH_APPROVAL: { kind: 'APPROVE_PROPOSAL', slot: 'confirmer' },
  PENDING_TECH_REVIEW: { kind: 'APPROVE_PROPOSAL', slot: 'consultant' },
  PENDING_BOARD_APPROVAL: { kind: 'APPROVE_PROPOSAL', slot: 'board' },
  NEEDS_SUBMISSION_UPDATE: { kind: 'PREPARE_PROPOSAL', slot: 'manager' },
  REJECTED_RESUBMITTABLE: { kind: 'PREPARE_PROPOSAL', slot: 'manager' },
  READY_FOR_CONSTRUCTION: { kind: 'START_CONSTRUCTION', slot: 'manager' },
  IN_CONSTRUCTION: { kind: 'UPDATE_CONSTRUCTION', slot: 'manager' },
  NEEDS_REPAIR: { kind: 'FIX_DEFECT', slot: 'manager' },
  PENDING_PAYMENT_REQUEST: { kind: 'PREPARE_PAYMENT_REQUEST', slot: 'manager' },
  NEEDS_PAYMENT_UPDATE: { kind: 'PREPARE_PAYMENT_REQUEST', slot: 'manager' },
  PENDING_PAYMENT_APPROVAL: { kind: 'APPROVE_PAYMENT', slot: 'board' },
  PENDING_PAYMENT: { kind: 'RECORD_PAYMENT', slot: 'manager' },
};

const OCCURRENCE_TASK: Partial<Record<OccurrenceStatus, TaskTarget>> = {
  SCHEDULED: { kind: 'PERFORM_MAINTENANCE', slot: 'manager' },
  IN_PROGRESS: { kind: 'PERFORM_MAINTENANCE', slot: 'manager' },
  REWORK: { kind: 'REWORK_MAINTENANCE', slot: 'manager' },
  PENDING_REVIEW: { kind: 'REVIEW_MAINTENANCE', slot: 'confirmer' },
};

/** Capability the assignee needs to act on each task kind (mirrors the action definitions). */
const TASK_CAPABILITY: Record<TaskKind, Capability> = {
  UPDATE_RECORD: 'RECORD_EDIT',
  CONFIRM_RECORD: 'RECORD_CONFIRM',
  PREPARE_PROPOSAL: 'RECORD_EDIT',
  APPROVE_PROPOSAL: 'PROPOSAL_DECIDE',
  ISSUE_UNRESOLVED_NOTICE: 'RECORD_EDIT',
  SUBMIT_EMERGENCY_DOCS: 'RECORD_EDIT',
  START_CONSTRUCTION: 'CONSTRUCTION',
  UPDATE_CONSTRUCTION: 'CONSTRUCTION',
  REVIEW_ACCEPTANCE: 'ACCEPTANCE_DECIDE',
  FIX_DEFECT: 'CONSTRUCTION',
  PREPARE_PAYMENT_REQUEST: 'PAYMENT_RECORD',
  APPROVE_PAYMENT: 'PAYMENT_DECIDE',
  RECORD_PAYMENT: 'PAYMENT_RECORD',
  PERFORM_MAINTENANCE: 'MAINTENANCE_MANAGE',
  REVIEW_MAINTENANCE: 'MAINTENANCE_REVIEW',
  REWORK_MAINTENANCE: 'MAINTENANCE_MANAGE',
  REVIEW_SCHEDULE_CHANGE: 'MAINTENANCE_MANAGE',
  REASSIGN_REQUIRED: 'REASSIGN',
};

/**
 * Whether the user can still hold a slot on the subject: active, the slot's system role,
 * the subject's building and location in scope and, when given, the capability the step needs.
 */
export const isAssignable = (
  user: User | undefined,
  subject: AssignedSubject,
  slot: AssigneeSlot,
  capability?: Capability,
): user is User =>
  Boolean(user) &&
  (user as User).active &&
  (user as User).role === SLOT_ROLE[slot] &&
  canAccessLocation(user as User, subject.buildingId, subject.locationId) &&
  (!capability || hasCapability(user as User, capability));

export interface DesiredTask {
  kind: TaskKind;
  assigneeId: string;
  /** Slot whose assignee is inactive, when the task is a reassignment request. */
  blockedSlot?: AssigneeSlot;
}

const toDesired = (target: TaskTarget, subject: AssignedSubject, usersById: Map<string, User>): DesiredTask => {
  const assigneeId = slotUserId(subject, target.slot);
  const assignee = assigneeId ? usersById.get(assigneeId) : undefined;
  if (isAssignable(assignee, subject, target.slot, TASK_CAPABILITY[target.kind])) return { kind: target.kind, assigneeId: assignee.id };
  // Inactive or no longer eligible assignee: the manager must reassign first (spec section 7).
  return { kind: 'REASSIGN_REQUIRED', assigneeId: subject.managerUserId, blockedSlot: target.slot };
};

/** Keeps one reassignment request when several slots are blocked at once. */
const dedupe = (tasks: DesiredTask[]): DesiredTask[] =>
  tasks.filter(
    (task, index) => tasks.findIndex((other) => other.kind === task.kind && other.assigneeId === task.assigneeId) === index,
  );

/** Open tasks a record needs now; acceptance opens one task per reviewer still to decide (KT and TVKT). */
export const desiredRepairTasks = (record: RepairRecord, usersById: Map<string, User>): DesiredTask[] => {
  if (record.status === 'PENDING_ACCEPTANCE') {
    const slots = record.pendingAcceptanceSlots ?? [];
    return dedupe(slots.map((slot) => toDesired({ kind: 'REVIEW_ACCEPTANCE', slot }, record, usersById)));
  }
  if (record.status === 'UNRESOLVED') {
    return record.noticeIssuedAt ? [] : [toDesired({ kind: 'ISSUE_UNRESOLVED_NOTICE', slot: 'manager' }, record, usersById)];
  }
  const target = REPAIR_TASK[record.status];
  return target ? [toDesired(target, record, usersById)] : [];
};

/** Occurrences carry no location; pass the maintenance item's location so location scopes apply. */
export const desiredOccurrenceTasks = (
  occurrence: MaintenanceOccurrence,
  usersById: Map<string, User>,
  locationId?: string,
): DesiredTask[] => {
  if (occurrence.status === 'SCHEDULED' && occurrence.reviewFlag === 'SCHEDULE_CHANGED') {
    return [{ kind: 'REVIEW_SCHEDULE_CHANGE', assigneeId: occurrence.managerUserId }];
  }
  const target = OCCURRENCE_TASK[occurrence.status];
  return target ? [toDesired(target, { ...occurrence, locationId }, usersById)] : [];
};

/** Slots whose assignee is missing, inactive or no longer eligible (role, building, location); shows "Cần phân công lại". */
export const unassignableSlots = (subject: AssignedSubject, usersById: Map<string, User>): AssigneeSlot[] => {
  const slots: AssigneeSlot[] = ['manager', 'confirmer'];
  for (const slot of APPROVER_SLOTS) {
    if (slotUserId(subject, slot)) slots.push(slot);
  }
  return slots.filter((slot) => {
    const id = slotUserId(subject, slot);
    return !isAssignable(id ? usersById.get(id) : undefined, subject, slot);
  });
};
