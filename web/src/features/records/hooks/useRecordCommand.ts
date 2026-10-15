import { useCommand } from '@/hooks/useCommand';
import type { RepairAction } from '@/domain/actions';
import type { CommandResult } from '@/services/command-engine';
import { useRecordContext } from '../record-context';

interface Options {
  successMessage?: string;
  onSuccess?: (result: CommandResult) => void;
}

/** useCommand bound to the current record (subject + expectedVersion). One instance per dialog/intent. */
export const useRecordCommand = (options: Options = {}) => {
  const { detail } = useRecordContext();
  const command = useCommand(options);
  const run = (action: RepairAction, payload: unknown = {}) =>
    command.execute({
      subjectType: 'REPAIR_RECORD',
      subjectId: detail.record.id,
      expectedVersion: detail.record.version,
      action,
      payload,
    });
  return { ...command, run };
};
