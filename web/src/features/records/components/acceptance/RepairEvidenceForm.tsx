import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { formatDateTime } from '@/utils/date';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { pickAttachments } from '../../record-utils';
import { AttachmentField } from '../shared/AttachmentField';
import { FieldErrorList } from '../shared/FieldErrorList';

/** NEEDS_REPAIR: save fix notes/photos, then resubmit acceptance (new round). */
export const RepairEvidenceForm = () => {
  const { detail } = useRecordContext();
  const evidence = detail.construction?.repairEvidence;
  const save = useRepairAction('saveRepairEvidence');
  const resubmit = useRepairAction('resubmitAcceptance');
  const [note, setNote] = useState(evidence?.note ?? '');
  const photos = useAttachmentDraft(pickAttachments(detail.attachments, evidence?.attachmentIds ?? []));
  const saveCommand = useRecordCommand({ successMessage: 'Đã lưu nội dung khắc phục.' });
  const resubmitCommand = useRecordCommand({ successMessage: 'Đã gửi nghiệm thu lại.' });
  if (!save.relevant) return null;
  const payload = { note: note.trim(), attachmentIds: photos.ids };
  const errors = { ...saveCommand.fieldErrors, ...resubmitCommand.fieldErrors };
  const isReadOnly = !save.state.allowed;
  return (
    <Card className="border-warn/40">
      <CardHeader
        title="Khắc phục sau nghiệm thu không đạt"
        description={evidence ? `Đã lưu lúc ${formatDateTime(evidence.updatedAt)}.` : 'Ghi nội dung khắc phục và ảnh sau khắc phục rồi gửi nghiệm thu lại.'}
      />
      <CardBody className="space-y-4">
        <Field label="Nội dung khắc phục" htmlFor="fix-note" required hint={`Tối thiểu ${LIMITS.REASON_MIN} ký tự khi gửi lại.`} error={errors.note}>
          <Textarea id="fix-note" rows={4} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả nội dung đã khắc phục..." value={note} disabled={isReadOnly} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <AttachmentField
          label="Ảnh sau khắc phục"
          recordId={detail.record.id}
          purpose="CONSTRUCTION"
          items={photos.items}
          onAdd={photos.add}
          onRemove={photos.remove}
          required
          disabled={isReadOnly}
          hint="Cần ít nhất 1 ảnh khi gửi nghiệm thu lại."
          error={errors.attachmentIds}
          uploadLabel="Thêm ảnh"
        />
        <FieldErrorList errors={errors} exclude={['note', 'attachmentIds']} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton state={save.state} variant="secondary" isLoading={saveCommand.isPending} onClick={() => void saveCommand.run('saveRepairEvidence', payload)}>
            {REPAIR_ACTIONS.saveRepairEvidence.label}
          </ActionButton>
          <ActionButton state={resubmit.state} isLoading={resubmitCommand.isPending} onClick={() => void resubmitCommand.run('resubmitAcceptance', payload)}>
            {REPAIR_ACTIONS.resubmitAcceptance.label}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
