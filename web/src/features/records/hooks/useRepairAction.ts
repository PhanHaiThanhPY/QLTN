import type { ActionState, RepairAction } from '@/domain/actions';
import { useRecordContext } from '../record-context';
import { isActionRelevant, repairActionState } from '../record-utils';

export interface RepairActionInfo {
  /** False when the action does not belong to the current status: the UI hides it. */
  relevant: boolean;
  state: ActionState;
}

export const useRepairAction = (action: RepairAction): RepairActionInfo => {
  const { detail, viewer } = useRecordContext();
  return {
    relevant: isActionRelevant(action, detail.record.status),
    state: repairActionState(action, viewer, detail.record),
  };
};
