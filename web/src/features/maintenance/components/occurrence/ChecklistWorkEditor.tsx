import { toast } from 'sonner';
import { ActionButton } from '@/components/common/ActionButton';
import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import type { Attachment, MaintenanceOccurrence, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { draftPayload, useChecklistDraft } from '../../hooks/useChecklistDraft';
import { pickAttachments } from './ChecklistEntriesView';
import { ChecklistEntryEditor } from './ChecklistEntryEditor';

interface ChecklistWorkEditorProps {
  occurrence: MaintenanceOccurrence;
  attachments: Attachment[];
  viewer: User;
}

/** Editable working copy for the managing BQL while IN_PROGRESS / REWORK. */
export const ChecklistWorkEditor = ({ occurrence, attachments, viewer }: ChecklistWorkEditorProps) => {
  const api = useChecklistDraft(occurrence);
  const { draft } = api;
  const save = useCommand();
  const submit = useCommand();
  const errors = { ...save.fieldErrors, ...submit.fieldErrors };
  const attachmentsById = new Map([...attachments, ...api.uploaded].map((row) => [row.id, row]));
  const base = { subjectType: 'MAINTENANCE_OCCURRENCE' as const, subjectId: occurrence.id, expectedVersion: api.baseVersion };

  const handleSave = async () => {
    const result = await save.execute({ ...base, action: 'saveMaintenanceProgress', payload: draftPayload(draft) });
    if (!result) return;
    api.markSaved();
    toast.success('Đã lưu tiến độ.');
  };
  const handleSubmit = async () => {
    const result = await submit.execute({ ...base, action: 'submitMaintenance', payload: draftPayload(draft) });
    if (!result) return;
    toast.success(`Đã gửi kết quả lần ${String(result.data?.roundNo ?? '')}. Chờ người xác nhận kiểm tra.`);
  };

  return (
    <div className="space-y-4">
      {api.isStale ? (
        <Notice tone="warning" title="Lượt vừa được cập nhật">
          <p>
            Bản đang nhập dựa trên phiên bản {api.baseVersion}; dữ liệu hiện tại là phiên bản {occurrence.version}. Chọn tải bản mới hoặc giữ
            bản đang nhập rồi lưu đè.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={api.reload}>
              Tải bản mới
            </Button>
            <Button size="sm" variant="ghost" onClick={api.keepMine}>
              Giữ bản đang nhập
            </Button>
          </div>
        </Notice>
      ) : null}
      {occurrence.status === 'REWORK' ? (
        <Notice tone="warning">Người xác nhận yêu cầu làm lại — xem lý do ở lần gửi gần nhất bên dưới, sửa bản làm việc rồi gửi lại.</Notice>
      ) : null}
      <Card>
        <CardHeader title="Checklist" description="Chỉ trả lời các mục của lượt; không thêm/bớt mục. Mục tùy chọn để trống được ghi “Không kiểm tra”." />
        <CardBody>
          {errors.checklist ? <p className="mb-2 text-xs text-crit">{errors.checklist}</p> : null}
          <ol className="space-y-3">
            {draft.checklist.map((entry, index) => (
              <ChecklistEntryEditor
                key={entry.templateItemId}
                index={index}
                entry={entry}
                occurrenceId={occurrence.id}
                attachmentsById={attachmentsById}
                serverError={errors[`checklist.${index}`]}
                onResult={(result) => api.setResult(index, result)}
                onNote={(note) => api.setNote(index, note)}
                onFiles={(files) => api.addEntryFiles(index, files)}
                onRemoveFile={(id) => api.removeEntryFile(index, id)}
              />
            ))}
          </ol>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Kết quả" />
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Đơn vị thực hiện" htmlFor="wk-performer" required error={errors.performerName} hint="Tên đơn vị/người thực hiện ngoài hệ thống.">
            <Input id="wk-performer" maxLength={200} placeholder="Tên đơn vị hoặc người thực hiện" value={draft.performerName} onChange={(event) => api.setField('performerName', event.target.value)} />
          </Field>
          <Field label="Nhà thầu (nếu có)" htmlFor="wk-contractor" error={errors.contractorName}>
            <Input
              id="wk-contractor"
              maxLength={LIMITS.CONTRACTOR_NAME_MAX}
              placeholder="Tên nhà thầu (nếu có)"
              value={draft.contractorName}
              onChange={(event) => api.setField('contractorName', event.target.value)}
            />
          </Field>
          <Field label="Kết luận" htmlFor="wk-note" required error={errors.resultNote} className="md:col-span-2">
            <Textarea id="wk-note" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Nhập kết luận và kết quả thực hiện..." value={draft.resultNote} onChange={(event) => api.setField('resultNote', event.target.value)} />
          </Field>
          <Field label="Ảnh kết quả" required error={errors.attachmentIds} hint="Cần ít nhất 1 ảnh (ở mục checklist hoặc ảnh chung)." className="md:col-span-2">
            <div className="space-y-2">
              {draft.attachmentIds.length > 0 ? (
                <AttachmentList attachments={pickAttachments(draft.attachmentIds, attachmentsById)} onRemove={api.removeResultFile} />
              ) : null}
              <FileUploader subjectType="MAINTENANCE_OCCURRENCE" subjectId={occurrence.id} purpose="MAINTENANCE_RESULT" label="Thêm ảnh kết quả" onUploaded={api.addResultFiles} />
            </div>
          </Field>
        </CardBody>
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ActionButton
          state={evaluateAction(OCCURRENCE_ACTIONS.saveMaintenanceProgress, viewer, occurrence)}
          variant="secondary"
          isLoading={save.isPending}
          onClick={() => void handleSave()}
        >
          Lưu tiến độ
        </ActionButton>
        <ActionButton
          state={evaluateAction(OCCURRENCE_ACTIONS.submitMaintenance, viewer, occurrence)}
          isLoading={submit.isPending}
          onClick={() => void handleSubmit()}
        >
          Gửi kết quả
        </ActionButton>
      </div>
    </div>
  );
};
