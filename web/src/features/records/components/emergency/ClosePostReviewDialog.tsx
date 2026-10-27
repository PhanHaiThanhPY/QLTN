import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

const SHOWN = ['reason', 'attachmentIds'] as const;

/** E-T2 (B06-S1 BR-E-08): the BOARD holder records how the cost is handled, with optional files, and closes. */
export const ClosePostReviewDialog = ({ onClose }: { onClose: () => void }) => {
  const { detail } = useRecordContext();
  const [reason, setReason] = useState('');
  const files = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã ghi quyết định và đóng hồ sơ.', onSuccess: onClose });
  const errors = command.fieldErrors;
  return (
    <CommandDialog
      title="Ghi quyết định và đóng"
      description="Hồ sơ chuyển sang “Đã đóng: không được duyệt hậu kiểm”. Không có thanh toán trong hệ thống."
      confirmLabel="Đóng hồ sơ"
      confirmVariant="danger"
      isPending={command.isPending}
      canConfirm={reason.trim().length >= LIMITS.REASON_MIN}
      onClose={onClose}
      onConfirm={() => void command.run('closePostReviewRejected', { reason: reason.trim(), attachmentIds: files.ids })}
    >
      <Field label="Quyết định xử lý chi phí" htmlFor="prr-reason" required hint="5–1000 ký tự. VD: nhà thầu tự chịu, trích nguồn khác ngoài quỹ." error={errors.reason}>
        <Textarea id="prr-reason" rows={3} maxLength={LIMITS.REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <AttachmentField
        label="Tệp quyết định"
        recordId={detail.record.id}
        purpose="BOARD_DECISION"
        items={files.items}
        onAdd={files.add}
        onRemove={files.remove}
        error={errors.attachmentIds}
      />
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
