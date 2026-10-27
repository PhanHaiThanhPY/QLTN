import { AppError, ERROR_CODE } from '@/domain/errors';
import { asRecord } from '@/domain/validation';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import { MISSING_VERSION_MESSAGE } from './version';

type PlanCommandHandler = (command: Command) => Promise<CommandResult>;

const pathOf = (base: 'maintenance-plans' | 'maintenance-occurrences', command: Command, suffix = ''): string => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, base === 'maintenance-plans' ? 'Không tìm thấy kế hoạch.' : 'Không tìm thấy lượt bảo trì.');
  return `/${base}/${encodeURIComponent(id)}${suffix}`;
};

const versionOf = (command: Command): number => {
  if (command.expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return command.expectedVersion;
};

/** The api-mode plan screens build each payload in the API's own shape; only the version is added here. */
const post =
  (base: 'maintenance-plans' | 'maintenance-occurrences', suffix: string): PlanCommandHandler =>
  async (command) => {
    const saved = await apiRequest<{ id: string }>('POST', pathOf(base, command, suffix), {
      body: { ...asRecord(command.payload), version: versionOf(command) },
    });
    broadcastChange();
    // A make-up occurrence answers with the occurrence and an occurrence step with its page: the subject stays.
    return { ok: true, subjectId: base === 'maintenance-plans' ? (command.subjectId ?? saved.id) : (saved.id ?? command.subjectId) };
  };

/** Plan and occurrence commands of SPEC MT-S2 as REST calls (api mode only). */
export const MAINTENANCE_PLAN_COMMANDS: Readonly<Record<string, PlanCommandHandler>> = {
  createMaintenancePlan: async (command) => {
    const saved = await apiRequest<{ id: string }>('POST', '/maintenance-plans', { body: asRecord(command.payload) });
    broadcastChange();
    return { ok: true, subjectId: saved.id };
  },
  updateMaintenancePlan: async (command) => {
    const saved = await apiRequest<{ id: string }>('PATCH', pathOf('maintenance-plans', command), {
      body: { ...asRecord(command.payload), version: versionOf(command) },
    });
    broadcastChange();
    return { ok: true, subjectId: saved.id };
  },
  activateMaintenancePlan: post('maintenance-plans', '/activate'),
  pauseMaintenancePlan: post('maintenance-plans', '/pause'),
  resumeMaintenancePlan: post('maintenance-plans', '/resume'),
  endMaintenancePlan: post('maintenance-plans', '/end'),
  changeMaintenanceSchedule: post('maintenance-plans', '/change-schedule'),
  createMakeupOccurrence: post('maintenance-plans', '/makeup'),
  rescheduleMaintenanceOccurrence: post('maintenance-occurrences', '/reschedule'),
  cancelMaintenanceOccurrence: post('maintenance-occurrences', '/cancel'),
  keepMaintenanceOccurrence: post('maintenance-occurrences', '/keep'),
  // MT-S3: running an occurrence; each answers the occurrence page, the screen refetches it.
  startMaintenanceOccurrence: post('maintenance-occurrences', '/start'),
  saveMaintenanceWork: post('maintenance-occurrences', '/save'),
  submitMaintenanceWork: post('maintenance-occurrences', '/submit'),
  requestMaintenanceOccurrenceRework: post('maintenance-occurrences', '/rework'),
  confirmMaintenanceOccurrence: post('maintenance-occurrences', '/confirm'),
  reassignMaintenanceOccurrence: post('maintenance-occurrences', '/reassign'),
  createRepairFromMaintenanceItem: async (command) => {
    const made = await apiRequest<{ recordId: string; code: string }>('POST', pathOf('maintenance-occurrences', command, '/repairs'), {
      body: { ...asRecord(command.payload), version: versionOf(command) },
    });
    broadcastChange();
    return { ok: true, subjectId: made.recordId, data: { code: made.code } };
  },
};
