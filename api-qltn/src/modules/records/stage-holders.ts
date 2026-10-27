import type { EntityManager } from 'typeorm';
import { conflictWithReason } from '../../common/errors';
import type { WorkflowStageKey } from '../../domain/building-config';
import type { RepairRecord } from './entities/repair-record.entity';
import { isActiveUserForApprovalStep, loadAssignmentContext } from './record-assignment';
import { approvalStepOf, stepHolderOf } from './record-steps';

/** Steps of a stage in the record snapshot; PAYMENT falls back to BOARD as the instalment chain does (BR-S4). */
export const stageStepKeysOf = (record: RepairRecord, stage: WorkflowStageKey): string[] => {
  const keys = [...(record.workflowStageApprovalStepKeys?.[stage] ?? [])];
  return stage === 'PAYMENT' && keys.length === 0 ? ['BOARD'] : keys;
};

/**
 * FX-S3 BR-FX3-02: before acceptance (T12, T16), the settlement (T18) or an advance (A1, A1b), every step of the
 * stage needs an active holder in role and scope, checked as BR-S2-04 does for the proposal chain. Otherwise 409
 * `step_holder_missing` names the first such step and nothing changes, instead of a record stuck on a step nobody can
 * decide. Reassigning the holder is US-S2 (R-06).
 */
export const assertStageHolders = async (
  manager: EntityManager,
  record: RepairRecord,
  stage: WorkflowStageKey,
): Promise<void> => {
  const assignment = await loadAssignmentContext(manager, record.buildingId);
  for (const key of stageStepKeysOf(record, stage)) {
    const step = approvalStepOf(record, key);
    const holder = stepHolderOf(record, key);
    if (step && isActiveUserForApprovalStep(assignment, holder, step, record.buildingId, record.locationId)) continue;
    throw conflictWithReason(
      'step_holder_missing',
      `Bước «${step?.label ?? key}» chưa có người xử lý hợp lệ. Liên hệ quản trị để giao người.`,
    );
  }
};
