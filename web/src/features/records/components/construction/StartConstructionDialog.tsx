import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { IS_API_MODE } from '@/config/data-source';
import { LIMITS } from '@/domain/constants';
import { todayVn } from '@/services/runtime';
import { addDays } from '@/utils/date';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

/** startConstruction: start date + planned end date; against api-qltn also the plan note sent to BQT and TVKT (BR-S3-01). */
export const StartConstructionDialog = ({ onClose }: { onClose: () => void }) => {
  const today = todayVn();
  const [startDate, setStartDate] = useState(today);
  const [plannedEndDate, setPlannedEndDate] = useState(addDays(today, 7));
  const [planNote, setPlanNote] = useState('');
  const command = useRecordCommand({ successMessage: 'Đã bắt đầu thi công.', onSuccess: onClose });
  return (
    <CommandDialog
      title="Bắt đầu thi công"
      confirmLabel="Bắt đầu thi công"
      isPending={command.isPending}
      canConfirm={Boolean(startDate && plannedEndDate)}
      onClose={onClose}
      onConfirm={() =>
        void command.run('startConstruction', { startDate, plannedEndDate, ...(IS_API_MODE ? { planNote: planNote.trim() } : {}) })
      }
    >
      <Field label="Ngày bắt đầu" htmlFor="con-start" required error={command.fieldErrors.startDate}>
        <Input id="con-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </Field>
      <Field label="Ngày dự kiến hoàn thành" htmlFor="con-end" required error={command.fieldErrors.plannedEndDate}>
        <Input id="con-end" type="date" min={startDate} value={plannedEndDate} onChange={(event) => setPlannedEndDate(event.target.value)} />
      </Field>
      {IS_API_MODE ? (
        <Field
          label="Ghi chú kế hoạch"
          htmlFor="con-plan"
          required
          hint="5–1000 ký tự. Gửi kèm thông báo kế hoạch tới BQT và TVKT."
          error={command.fieldErrors.planNote}
        >
          <Textarea id="con-plan" rows={3} maxLength={LIMITS.REASON_MAX} value={planNote} onChange={(event) => setPlanNote(event.target.value)} />
        </Field>
      ) : null}
      <FieldErrorList errors={command.fieldErrors} exclude={['startDate', 'plannedEndDate', 'planNote']} />
    </CommandDialog>
  );
};
