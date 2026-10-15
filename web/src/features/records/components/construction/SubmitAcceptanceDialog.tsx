import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { todayVn } from '@/services/runtime';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

/** submitAcceptance: completed date, completion note and at least one result photo. */
export const SubmitAcceptanceDialog = ({ onClose }: { onClose: () => void }) => {
  const { detail } = useRecordContext();
  const today = todayVn();
  const [completedDate, setCompletedDate] = useState(today);
  const [note, setNote] = useState('');
  const photos = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã gửi nghiệm thu.', onSuccess: onClose });
  return (
    <CommandDialog
      title="Gửi nghiệm thu"
      description="Người xác nhận kỹ thuật sẽ kiểm tra và ghi nhận đạt / không đạt."
      confirmLabel="Gửi nghiệm thu"
      isPending={command.isPending}
      canConfirm={note.trim().length >= LIMITS.REASON_MIN}
      onClose={onClose}
      onConfirm={() => void command.run('submitAcceptance', { completedDate, note: note.trim(), attachmentIds: photos.ids })}
    >
      <Field label="Ngày hoàn thành" htmlFor="acc-date" required hint="Không trước ngày bắt đầu, không ở tương lai." error={command.fieldErrors.completedDate}>
        <Input
          id="acc-date"
          type="date"
          min={detail.construction?.startDate}
          max={today}
          value={completedDate}
          onChange={(event) => setCompletedDate(event.target.value)}
        />
      </Field>
      <Field label="Nội dung hoàn thành" htmlFor="acc-note" required error={command.fieldErrors.note}>
        <Textarea id="acc-note" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả nội dung hoàn thành và kết quả nghiệm thu..." value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <AttachmentField
        label="Ảnh kết quả"
        recordId={detail.record.id}
        purpose="CONSTRUCTION"
        items={photos.items}
        onAdd={photos.add}
        onRemove={photos.remove}
        required
        hint="Cần ít nhất 1 ảnh."
        error={command.fieldErrors.attachmentIds}
        uploadLabel="Thêm ảnh"
      />
      <FieldErrorList errors={command.fieldErrors} exclude={['completedDate', 'note', 'attachmentIds']} />
    </CommandDialog>
  );
};
