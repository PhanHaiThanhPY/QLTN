import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { ExecutionHistory } from '@/domain/execution';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { DialogActionButton } from '../shared/DialogActionButton';
import { MinutesFormDialog } from './MinutesFormDialog';

/** NEEDS_REPAIR: the failed points, the repair work in progress (T15) and a new acceptance round (T16). */
export const RepairDraftCard = ({ execution }: { execution: ExecutionHistory }) => {
  const { detail } = useRecordContext();
  const save = useRepairAction('saveRepairEvidence');
  const [note, setNote] = useState(execution.repairDraft?.note ?? '');
  const command = useRecordCommand({ successMessage: 'Đã lưu nội dung khắc phục.' });
  if (!save.relevant) return null;
  const failed = execution.acceptances.at(-1)?.decisions.filter((row) => row.outcome === 'FAILED') ?? [];
  return (
    <Card className="border-crit/40">
      <CardHeader
        title="Cần khắc phục"
        description={failed.map((row) => row.note).filter(Boolean).join(' · ') || 'Lượt nghiệm thu gần nhất không đạt.'}
        actions={
          <DialogActionButton
            action="resubmitAcceptance"
            renderDialog={(close) => (
              <MinutesFormDialog recordId={detail.record.id} action="resubmitAcceptance" initialContent={note} onClose={close} />
            )}
          />
        }
      />
      <CardBody className="space-y-3">
        <Field label="Nội dung khắc phục" htmlFor="repair-note" hint="Lưu lại để dùng khi gửi nghiệm thu lại." error={command.fieldErrors.note}>
          <Textarea id="repair-note" rows={3} maxLength={LIMITS.REASON_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex justify-end">
          <ActionButton state={save.state} variant="secondary" isLoading={command.isPending} onClick={() => void command.run('saveRepairEvidence', { note: note.trim() })}>
            Lưu nội dung khắc phục
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
