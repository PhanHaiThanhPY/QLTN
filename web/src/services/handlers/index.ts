import { registerHandlers } from '../command-engine';
import { accountHandlers } from './account-handlers';
import { buildingHandlers } from './building-handlers';
import { emergencyHandlers } from './emergency-handlers';
import { linkAndAssignmentHandlers } from './link-and-assignment-handlers';
import { maintenanceItemHandlers } from './maintenance-item-handlers';
import { maintenanceOccurrenceHandlers } from './maintenance-occurrence-handlers';
import { maintenancePlanHandlers } from './maintenance-plan-handlers';
import { notificationHandlers } from './notification-handlers';
import { repairExecutionHandlers } from './repair-execution-handlers';
import { repairProposalHandlers } from './repair-proposal-handlers';
import { repairRecordHandlers } from './repair-record-handlers';
import { unresolvedNoticeHandlers } from './unresolved-notice-handlers';

let registered = false;

/** Registers every command handler once; call before executing commands. */
export const registerAllHandlers = (): void => {
  if (registered) return;
  registerHandlers({
    ...repairRecordHandlers,
    ...repairProposalHandlers,
    ...repairExecutionHandlers,
    ...unresolvedNoticeHandlers,
    ...emergencyHandlers,
    ...buildingHandlers,
    ...accountHandlers,
    ...maintenanceItemHandlers,
    ...maintenancePlanHandlers,
    ...maintenanceOccurrenceHandlers,
    ...linkAndAssignmentHandlers,
    ...notificationHandlers,
  });
  registered = true;
};
