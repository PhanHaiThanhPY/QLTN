import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayVn } from '@/services/runtime';
import { addDays } from '@/utils/date';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

/** startConstruction: start date + planned end date. */
export const StartConstructionDialog = ({ onClose }: { onClose: () => void }) => {
  const today = todayVn();
  const [startDate, setStartDate] = useState(today);
  const [plannedEndDate, setPlannedEndDate] = useState(addDays(today, 7));
  const command = useRecordCommand({ successMessage: 'Đã bắt đầu thi công.', onSuccess: onClose });
  return (
    <CommandDialog
      title="Bắt đầu thi công"
      confirmLabel="Bắt đầu thi công"
      isPending={command.isPending}
      canConfirm={Boolean(startDate && plannedEndDate)}
      onClose={onClose}
      onConfirm={() => void command.run('startConstruction', { startDate, plannedEndDate })}
    >
      <Field label="Ngày bắt đầu" htmlFor="con-start" required error={command.fieldErrors.startDate}>
        <Input id="con-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </Field>
      <Field label="Ngày dự kiến hoàn thành" htmlFor="con-end" required error={command.fieldErrors.plannedEndDate}>
        <Input id="con-end" type="date" min={startDate} value={plannedEndDate} onChange={(event) => setPlannedEndDate(event.target.value)} />
      </Field>
      <FieldErrorList errors={command.fieldErrors} exclude={['startDate', 'plannedEndDate']} />
    </CommandDialog>
  );
};
