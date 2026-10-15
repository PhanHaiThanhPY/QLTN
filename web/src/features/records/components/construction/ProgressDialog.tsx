import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

const PROGRESS_ERROR = 'Tiến độ là số nguyên từ 0 đến 100.';

/** Client-side mirror of the service rule; the service still validates on submit. */
const progressErrorOf = (text: string): string | undefined => {
  if (text.trim() === '') return undefined;
  const number = Number(text);
  return Number.isInteger(number) && number >= 0 && number <= 100 ? undefined : PROGRESS_ERROR;
};

/** updateConstruction: progress 0–100, log note and CONSTRUCTION photos. */
export const ProgressDialog = ({ onClose }: { onClose: () => void }) => {
  const { detail } = useRecordContext();
  const [progress, setProgress] = useState(String(detail.construction?.progressPercent ?? 0));
  const [note, setNote] = useState('');
  const photos = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã cập nhật tiến độ thi công.', onSuccess: onClose });
  const value = Number(progress);
  const progressError = progressErrorOf(progress);
  return (
    <CommandDialog
      title="Cập nhật tiến độ thi công"
      confirmLabel="Lưu tiến độ"
      isPending={command.isPending}
      canConfirm={progress.trim() !== '' && !progressError && note.trim().length >= LIMITS.REASON_MIN}
      onClose={onClose}
      onConfirm={() => {
        if (progressError) return;
        void command.run('updateConstruction', { progressPercent: value, note: note.trim(), attachmentIds: photos.ids });
      }}
    >
      <Field label="Tiến độ (%)" htmlFor="con-progress" required hint="Số nguyên từ 0 đến 100." error={progressError ?? command.fieldErrors.progressPercent}>
        <Input id="con-progress" type="number" aria-invalid={Boolean(progressError)} inputMode="numeric" min={0} max={100} step={1} placeholder="VD: 75" value={progress} onChange={(event) => setProgress(event.target.value)} />
      </Field>
      <Field label="Nhật ký thi công" htmlFor="con-note" required hint={`Tối thiểu ${LIMITS.REASON_MIN} ký tự.`} error={command.fieldErrors.note}>
        <Textarea id="con-note" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Ghi lại công việc đã thực hiện..." value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <AttachmentField
        label="Ảnh thi công"
        recordId={detail.record.id}
        purpose="CONSTRUCTION"
        items={photos.items}
        onAdd={photos.add}
        onRemove={photos.remove}
        error={command.fieldErrors.attachmentIds}
        uploadLabel="Thêm ảnh"
      />
      <FieldErrorList errors={command.fieldErrors} exclude={['progressPercent', 'note', 'attachmentIds']} />
    </CommandDialog>
  );
};
