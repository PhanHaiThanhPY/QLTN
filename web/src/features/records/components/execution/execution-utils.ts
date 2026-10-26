import { APPROVAL_STEP_SLOT } from '@/domain/actions';
import type { ActionState } from '@/domain/actions';
import { APPROVAL_STEPS } from '@/domain/constants';
import type { AcceptanceRound } from '@/domain/execution';
import { hasCapability, slotUserId } from '@/domain/permissions';
import type { RepairRecord, User } from '@/domain/types';

/** Holder of an acceptance member step: the manager for MANAGER, else the unified map, else the legacy column. */
export const memberHolderId = (record: RepairRecord, stepKey: string): string | undefined => {
  if (stepKey === 'MANAGER') return record.managerUserId;
  const mapped = record.approvalAssigneeUserIds?.[stepKey];
  if (mapped) return mapped;
  const slot = APPROVAL_STEP_SLOT[stepKey];
  return slot ? slotUserId(record, slot) : undefined;
};

/** Label from the record snapshot, then the built-in steps (a snapshot may predate a built-in step such as MANAGER). */
export const memberLabel = (record: RepairRecord, stepKey: string): string =>
  [...(record.workflowApprovalSteps ?? []), ...APPROVAL_STEPS].find((step) => step.key === stepKey)?.label ?? stepKey;

/** Member steps the viewer holds and has not decided yet in the round (BR-S3-02). */
export const openStepsOf = (record: RepairRecord, round: AcceptanceRound, viewerId: string): string[] =>
  round.memberStepKeys.filter(
    (key) => memberHolderId(record, key) === viewerId && !round.decisions.some((decision) => decision.stepKey === key),
  );

/**
 * Whether the viewer may decide now (T13/T14). The demo's acceptance slot rule does not know the MANAGER step, so the
 * api screens check capability, status and an open member step here; the server checks the same, in that order.
 */
export const memberDecisionState = (viewer: User, record: RepairRecord, openStep: string | undefined): ActionState => {
  if (!hasCapability(viewer, 'ACCEPTANCE_DECIDE')) return { allowed: false, reason: 'Bạn không có quyền nghiệm thu.' };
  if (record.status !== 'PENDING_ACCEPTANCE') return { allowed: false, reason: 'Hồ sơ không ở bước chờ nghiệm thu.' };
  if (!openStep) return { allowed: false, reason: 'Bạn không còn bước nghiệm thu nào cần quyết định trong lượt này.' };
  return { allowed: true };
};
