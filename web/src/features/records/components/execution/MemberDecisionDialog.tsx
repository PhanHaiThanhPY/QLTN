import { useState } from 'react';
import { SignaturePad } from '@/components/common/SignaturePad';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

interface MemberDecisionDialogProps {
  recordId: string;
  roundId: string;
  roundNo: number;
  stepLabel: string;
  outcome: 'pass' | 'fail';
  onClose: () => void;
}

/** T13/T14: one member's conclusion, signed (BR-S3-03). A failure needs the points to repair. */
export const MemberDecisionDialog = ({ recordId, roundId, roundNo, stepLabel, outcome, onClose }: MemberDecisionDialogProps) => {
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const files = useAttachmentDraft();
  const isPass = outcome === 'pass';
  const command = useRecordCommand({
    successMessage: isPass ? 'Đã ghi nghiệm thu ĐẠT.' : 'Đã ghi nghiệm thu KHÔNG ĐẠT.',
    onSuccess: onClose,
  });
  const errors = command.fieldErrors;
  return (
    <CommandDialog
      title={`${isPass ? 'Nghiệm thu ĐẠT' : 'Nghiệm thu KHÔNG ĐẠT'} · ${stepLabel}`}
      description={`Lượt ${roundNo}. ${isPass ? 'Lượt đạt khi mọi thành phần đều đạt.' : 'Hồ sơ chuyển sang “Cần khắc phục” ngay.'}`}
      confirmLabel={isPass ? 'Xác nhận ĐẠT' : 'Xác nhận KHÔNG ĐẠT'}
      confirmVariant={isPass ? 'primary' : 'danger'}
      isPending={command.isPending}
      canConfirm={Boolean(signature)}
      onClose={onClose}
      onConfirm={() =>
        void command.run(isPass ? 'passAcceptance' : 'failAcceptance', {
          acceptanceId: roundId,
          note: note.trim(),
          signature: signature ?? '',
          attachmentIds: files.ids,
        })
      }
      size="lg"
    >
      <Field
        label={isPass ? 'Điểm cần lưu ý' : 'Điểm cần khắc phục'}
        htmlFor="member-note"
        required={!isPass}
        hint={isPass ? 'Không bắt buộc, tối đa 1000 ký tự.' : '5–1000 ký tự.'}
        error={errors.note}
      >
        <Textarea id="member-note" rows={3} maxLength={LIMITS.REASON_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <AttachmentField label="Tệp đính kèm (không bắt buộc)" recordId={recordId} purpose="ACCEPTANCE" items={files.items} onAdd={files.add} onRemove={files.remove} error={errors.attachmentIds} />
      <Field label="Chữ ký" required error={errors.signature}>
        <SignaturePad onChange={setSignature} invalid={Boolean(errors.signature)} label="Chữ ký thành phần nghiệm thu" />
      </Field>
      <FieldErrorList errors={errors} exclude={['note', 'signature', 'attachmentIds']} />
    </CommandDialog>
  );
};
