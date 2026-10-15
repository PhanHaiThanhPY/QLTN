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

interface AcceptanceDecisionDialogProps {
  outcome: 'pass' | 'fail';
  roundNo: number;
  onClose: () => void;
}

const decisionHint = (isPass: boolean, isLastReviewer: boolean): string => {
  if (!isPass) return 'Hồ sơ chuyển sang “Cần khắc phục”; biên bản lượt này được giữ lại.';
  if (isLastReviewer) return 'Bạn là người nghiệm thu cuối: hồ sơ chuyển sang “Chờ đề nghị thanh toán”.';
  return 'Lượt này còn chờ người nghiệm thu còn lại (Kỹ thuật hoặc TVKT).';
};

/** KT or TVKT decision on the pending round; KT passing requires report files (ACCEPTANCE), TVKT may attach one. */
export const AcceptanceDecisionDialog = ({ outcome, roundNo, onClose }: AcceptanceDecisionDialogProps) => {
  const { detail, viewer } = useRecordContext();
  const isPass = outcome === 'pass';
  const needsReport = isPass && detail.record.confirmationUserId === viewer.id;
  const isLastReviewer = (detail.record.pendingAcceptanceSlots ?? []).length <= 1;
  const [note, setNote] = useState('');
  const reports = useAttachmentDraft();
  const command = useRecordCommand({
    successMessage: isPass ? 'Đã ghi nhận nghiệm thu đạt.' : 'Đã ghi nhận nghiệm thu không đạt.',
    onSuccess: onClose,
  });
  const canConfirm = note.trim().length >= LIMITS.REASON_MIN && (!needsReport || reports.ids.length > 0);
  return (
    <CommandDialog
      title={isPass ? `Nghiệm thu đạt – lượt ${roundNo}` : `Nghiệm thu không đạt – lượt ${roundNo}`}
      description={decisionHint(isPass, isLastReviewer)}
      confirmLabel={isPass ? 'Nghiệm thu đạt' : 'Nghiệm thu không đạt'}
      confirmVariant={isPass ? 'primary' : 'danger'}
      isPending={command.isPending}
      canConfirm={canConfirm}
      onClose={onClose}
      onConfirm={() => void command.run(isPass ? 'passAcceptance' : 'failAcceptance', { note: note.trim(), reportAttachmentIds: reports.ids })}
    >
      <Field
        label={isPass ? 'Kết luận nghiệm thu' : 'Nội dung chưa đạt'}
        htmlFor="acc-decision-note"
        required
        hint={`Tối thiểu ${LIMITS.REASON_MIN} ký tự.`}
        error={command.fieldErrors.note}
      >
        <Textarea id="acc-decision-note" rows={4} maxLength={LIMITS.REASON_MAX} placeholder="Nhập nhận xét và kết luận nghiệm thu..." value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <AttachmentField
        label="Biên bản nghiệm thu"
        recordId={detail.record.id}
        purpose="ACCEPTANCE"
        items={reports.items}
        onAdd={reports.add}
        onRemove={reports.remove}
        required={needsReport}
        hint={needsReport ? 'Kỹ thuật bắt buộc đính kèm khi nghiệm thu đạt.' : 'Tùy chọn.'}
        error={command.fieldErrors.reportAttachmentIds}
      />
      <FieldErrorList errors={command.fieldErrors} exclude={['note', 'reportAttachmentIds']} />
    </CommandDialog>
  );
};
