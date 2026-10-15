import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Field } from '@/components/ui/field';
import type { AttachmentPurpose } from '@/domain/constants';
import type { Attachment } from '@/domain/types';

interface AttachmentFieldProps {
  label: string;
  recordId: string;
  purpose: AttachmentPurpose;
  items: Attachment[];
  onAdd: (rows: Attachment[]) => void;
  onRemove: (id: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  uploadLabel?: string;
  accept?: string;
}

/** Upload-immediately file picker plus the list of files that will be sent with the command. */
export const AttachmentField = ({
  label,
  recordId,
  purpose,
  items,
  onAdd,
  onRemove,
  error,
  hint,
  required = false,
  disabled = false,
  uploadLabel = 'Thêm tệp',
  accept,
}: AttachmentFieldProps) => (
  <Field label={label} required={required} error={error} hint={hint}>
    <AttachmentList attachments={items} onRemove={disabled ? undefined : onRemove} emptyText="Chưa chọn tệp." />
    {disabled ? null : (
      <FileUploader subjectType="REPAIR_RECORD" subjectId={recordId} purpose={purpose} onUploaded={onAdd} label={uploadLabel} accept={accept} />
    )}
  </Field>
);
