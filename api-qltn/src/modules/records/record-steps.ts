import { APPROVAL_STEPS, CUSTOM_APPROVAL_STATUS, type WorkflowApprovalStep } from '../../domain/building-config';
import type { RepairRecord } from './entities/repair-record.entity';

/** Statuses where a proposal waits on an approval step (built-in steps plus the shared custom status). */
export const PROPOSAL_APPROVAL_STATUSES: readonly string[] = [
  ...APPROVAL_STEPS.map((step) => step.status),
  CUSTOM_APPROVAL_STATUS,
];

/** Records created before the unified map kept built-in holders in columns (ADR-0001 §4.3). */
const LEGACY_HOLDER_COLUMN: Partial<Record<string, 'confirmationUserId' | 'consultantUserId' | 'boardUserId'>> = {
  TECH_CONFIRM: 'confirmationUserId',
  TECH: 'consultantUserId',
  BOARD: 'boardUserId',
};

/** Definition of a step from the record snapshot, then the built-in library. */
export const approvalStepOf = (record: RepairRecord, key: string): WorkflowApprovalStep | undefined =>
  [...(record.workflowApprovalSteps ?? []), ...APPROVAL_STEPS].find((step) => step.key === key);

/** Proposal chain of the record snapshot, in order (steps unknown to the snapshot are skipped). */
export const proposalChainStepsOf = (record: RepairRecord): WorkflowApprovalStep[] =>
  record.approvalStepKeys
    .map((key) => approvalStepOf(record, key))
    .filter((step): step is WorkflowApprovalStep => Boolean(step));

/** Holder of a step: the unified map first (records since RM-S2/S2), the legacy column for older records. */
export const stepHolderOf = (record: RepairRecord, key: string): string | null => {
  const mapped = record.approvalAssigneeUserIds?.[key];
  if (mapped) return mapped;
  const column = LEGACY_HOLDER_COLUMN[key];
  return column ? record[column] : null;
};

/** Repair status while the record waits on a step. */
export const waitingStatusOf = (step: WorkflowApprovalStep): string =>
  APPROVAL_STEPS.some((fixed) => fixed.key === step.key) ? step.status : CUSTOM_APPROVAL_STATUS;

/**
 * Step the proposal currently waits on: the stored key, or for a record without one (snapshot before S2) the first
 * chain step whose waiting status matches the record status.
 */
export const currentStepKeyOf = (record: RepairRecord): string | null => {
  if (!PROPOSAL_APPROVAL_STATUSES.includes(record.status)) return null;
  if (record.currentApprovalStepKey) return record.currentApprovalStepKey;
  return proposalChainStepsOf(record).find((step) => waitingStatusOf(step) === record.status)?.key ?? null;
};
