import { APPROVAL_STEP_SLOT, approvalStepsFor } from '@/domain/actions';
import type { AcceptanceRound } from '@/domain/execution';
import { slotUserId } from '@/domain/permissions';
import type { RepairRecord } from '@/domain/types';

/** Holder of an acceptance member step: the manager for MANAGER, else the unified map, else the legacy column. */
export const memberHolderId = (record: RepairRecord, stepKey: string): string | undefined => {
  if (stepKey === 'MANAGER') return record.managerUserId;
  const mapped = record.approvalAssigneeUserIds?.[stepKey];
  if (mapped) return mapped;
  const slot = APPROVAL_STEP_SLOT[stepKey];
  return slot ? slotUserId(record, slot) : undefined;
};

export const memberLabel = (record: RepairRecord, stepKey: string): string =>
  approvalStepsFor([stepKey], record.workflowApprovalSteps)[0]?.label ?? stepKey;

/** Member steps the viewer holds and has not decided yet in the round (BR-S3-02). */
export const openStepsOf = (record: RepairRecord, round: AcceptanceRound, viewerId: string): string[] =>
  round.memberStepKeys.filter(
    (key) => memberHolderId(record, key) === viewerId && !round.decisions.some((decision) => decision.stepKey === key),
  );
