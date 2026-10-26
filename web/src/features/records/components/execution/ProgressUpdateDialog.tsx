import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

interface ProgressUpdateDialogProps {
  recordId: string;
  currentPercent: number;
  onClose: () => void;
}

/** T11: progress 0–100 with a note and optional site files (purpose CONSTRUCTION). */
export const ProgressUpdateDialog = ({ recordId, currentPercent, onClose }: ProgressUpdateDialogProps) => {
  const [percent, setPercent] = useState(String(currentPercent));
  const [note, setNote] = useState('');
  const files = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã cập nhật tiến độ.', onSuccess: onClose });
  const errors = command.fieldErrors;
  return (
    <CommandDialog
      title="Cập nhật tiến độ thi công"
      confirmLabel="Lưu tiến độ"
      isPending={command.isPending}
      onClose={onClose}
      onConfirm={() =>
        void command.run('updateConstruction', { progressPercent: Number(percent), note: note.trim(), attachmentIds: files.ids })
      }
    >
      <Field label="Tiến độ (%)" htmlFor="exe-progress" required error={errors.progressPercent}>
        <Input id="exe-progress" type="number" min={0} max={100} step={1} value={percent} onChange={(event) => setPercent(event.target.value)} />
      </Field>
      <Field label="Ghi chú" htmlFor="exe-progress-note" required hint="5–1000 ký tự." error={errors.note}>
        <Textarea id="exe-progress-note" rows={3} maxLength={LIMITS.REASON_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <AttachmentField label="Ảnh thi công" recordId={recordId} purpose="CONSTRUCTION" items={files.items} onAdd={files.add} onRemove={files.remove} error={errors.attachmentIds} />
      <FieldErrorList errors={errors} exclude={['progressPercent', 'note', 'attachmentIds']} />
    </CommandDialog>
  );
};
