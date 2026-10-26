import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { todayVn } from '@/services/runtime';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

interface MinutesFormDialogProps {
  recordId: string;
  action: 'submitAcceptance' | 'resubmitAcceptance';
  /** Content prefilled from the saved repair work when resubmitting. */
  initialContent?: string;
  onClose: () => void;
}

const SHOWN = ['completedDate', 'inspectedAt', 'inspectionLocation', 'content', 'otherMembers', 'photoAttachmentIds'] as const;

/** "datetime-local" value of now, in the browser's time (Vietnam for the users of the demo). */
const nowLocal = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** T12/T16: the acceptance minutes of a new round (SPEC §4.3); the members come from the workflow snapshot. */
export const MinutesFormDialog = ({ recordId, action, initialContent = '', onClose }: MinutesFormDialogProps) => {
  const [completedDate, setCompletedDate] = useState(todayVn());
  const [inspectedAt, setInspectedAt] = useState(nowLocal());
  const [location, setLocation] = useState('');
  const [content, setContent] = useState(initialContent);
  const [otherMembers, setOtherMembers] = useState('');
  const photos = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã gửi nghiệm thu.', onSuccess: onClose });
  const errors = command.fieldErrors;
  const submit = () =>
    void command.run(action, {
      completedDate,
      inspectedAt: inspectedAt ? new Date(inspectedAt).toISOString() : '',
      inspectionLocation: location.trim(),
      content: content.trim(),
      otherMembers: otherMembers.trim(),
      photoAttachmentIds: photos.ids,
    });
  return (
    <CommandDialog
      title={action === 'submitAcceptance' ? 'Gửi nghiệm thu' : 'Gửi nghiệm thu lại'}
      description="Hệ thống lập biên bản nghiệm thu lượt mới; các thành phần bắt buộc lấy theo workflow của hồ sơ."
      confirmLabel={action === 'submitAcceptance' ? 'Gửi nghiệm thu' : 'Gửi nghiệm thu lại'}
      isPending={command.isPending}
      onClose={onClose}
      onConfirm={submit}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ngày hoàn thành" htmlFor="min-completed" required error={errors.completedDate}>
          <Input id="min-completed" type="date" max={todayVn()} value={completedDate} onChange={(event) => setCompletedDate(event.target.value)} />
        </Field>
        <Field label="Thời gian nghiệm thu" htmlFor="min-inspected" required error={errors.inspectedAt}>
          <Input id="min-inspected" type="datetime-local" value={inspectedAt} onChange={(event) => setInspectedAt(event.target.value)} />
        </Field>
      </div>
      <Field label="Địa điểm nghiệm thu" htmlFor="min-location" required error={errors.inspectionLocation}>
        <Input id="min-location" maxLength={200} placeholder="Ví dụ: Hành lang tầng 3" value={location} onChange={(event) => setLocation(event.target.value)} />
      </Field>
      <Field label="Nội dung nghiệm thu (công việc, hạng mục)" htmlFor="min-content" required hint="10–2000 ký tự." error={errors.content}>
        <Textarea id="min-content" rows={4} maxLength={LIMITS.DESCRIPTION_MAX} value={content} onChange={(event) => setContent(event.target.value)} />
      </Field>
      <Field label="Thành phần khác" htmlFor="min-others" hint="Ví dụ: Đại diện cư dân: …" error={errors.otherMembers}>
        <Input id="min-others" maxLength={LIMITS.REASON_MAX} value={otherMembers} onChange={(event) => setOtherMembers(event.target.value)} />
      </Field>
      <AttachmentField label="Ảnh kết quả" recordId={recordId} purpose="ACCEPTANCE" items={photos.items} onAdd={photos.add} onRemove={photos.remove} required error={errors.photoAttachmentIds} accept="image/jpeg,image/png,image/webp" />
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
