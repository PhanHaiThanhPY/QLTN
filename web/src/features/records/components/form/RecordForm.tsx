import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { IS_API_MODE } from '@/config/data-source';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-layout';
import type { FieldErrors } from '@/domain/errors';
import type { Attachment, RepairRecord } from '@/domain/types';
import type { ReferenceData } from '@/services/reference-service';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordFormSubmit } from '../../hooks/useRecordFormSubmit';
import { pickAttachments } from '../../record-utils';
import { AttachmentField } from '../shared/AttachmentField';
import { FieldErrorList } from '../shared/FieldErrorList';
import { AssigneeFields } from './AssigneeFields';
import { PendingFilesField } from './PendingFilesField';
import { RecordInfoFields } from './RecordInfoFields';
import { defaultValuesFor, recordDraftSchema, recordSubmitSchema } from './record-form-schema';
import type { RecordFormIntent, RecordFormValues, RecordItemPrefill } from './record-form-schema';

interface RecordFormProps {
  reference: ReferenceData;
  record?: RepairRecord;
  attachments: Attachment[];
  /** Pre-selected building, location and equipment for a new record. */
  prefill?: RecordItemPrefill;
}

const SHOWN_FIELDS = ['buildingId', 'locationId', 'maintenanceItemId', 'title', 'description', 'priority', 'confirmationUserId', 'consultantUserId', 'boardUserId', 'attachmentIds'] as const;
const NO_PHOTO = 'Cần ít nhất 1 ảnh hiện trường.';

/** Field errors passed in router state by a failed submit right after creation. */
const readCarriedErrors = (state: unknown): FieldErrors | undefined => {
  if (!state || typeof state !== 'object' || !('fieldErrors' in state)) return undefined;
  const value = (state as { fieldErrors: unknown }).fieldErrors;
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
};

/** Create / edit form of a repair record (RHF + Zod); server errors are shown under fields. */
export const RecordForm = ({ reference, record, attachments, prefill }: RecordFormProps) => {
  const navigate = useNavigate();
  const isNew = !record;
  const defaultBuilding = reference.viewer.buildingIds.length === 1 ? reference.viewer.buildingIds[0] : '';
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordDraftSchema),
    defaultValues: defaultValuesFor(record, reference.users, defaultBuilding, prefill),
  });
  const photos = useAttachmentDraft(record ? pickAttachments(attachments, record.attachmentIds) : []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const location = useLocation();
  const submitter = useRecordFormSubmit({ record, photoIds: photos.ids, pendingFiles, carriedErrors: readCarriedErrors(location.state) });

  const hasImage = isNew
    ? pendingFiles.some((file) => file.type.startsWith('image/'))
    : photos.items.some((row) => row.mimeType.startsWith('image/'));

  const onValid = (intent: RecordFormIntent) => (values: RecordFormValues) => {
    setPhotoError(undefined);
    if (intent === 'submit') {
      const result = recordSubmitSchema.safeParse(values);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (typeof field === 'string') form.setError(field as keyof RecordFormValues, { type: 'manual', message: issue.message });
        }
      }
      if (!hasImage) setPhotoError(NO_PHOTO);
      if (!result.success || !hasImage) return;
    }
    void submitter.save(values, intent);
  };

  const serverErrors = submitter.fieldErrors;
  const photoFieldError = photoError ?? serverErrors.attachmentIds;
  const canPickAssignees = isNew || record.status === 'DRAFT';

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()} noValidate>
      {record?.status === 'NEEDS_RECORD_UPDATE' ? (
        <Notice tone="warning" title="Người xác nhận yêu cầu bổ sung thông tin">
          Xem lý do ở tab Tổng quan của hồ sơ, bổ sung rồi bấm “Gửi xác nhận”.
        </Notice>
      ) : null}
      <FormSection title="Thông tin hư hỏng">
        <RecordInfoFields form={form} reference={reference} isNew={isNew} serverErrors={serverErrors} />
      </FormSection>
      <FormSection title="Phân công xử lý" description="Có thể bổ sung sau khi lưu nháp. Các vai trò còn thiếu sẽ bắt buộc khi gửi xác nhận.">
        <AssigneeFields
          form={form}
          users={reference.users}
          managerUserId={record?.managerUserId ?? reference.viewer.id}
          editable={canPickAssignees}
          serverErrors={serverErrors}
          approvalStepKeys={record?.approvalStepKeys}
        />
      </FormSection>
      <FormSection title="Ảnh hiện trường" description={IS_API_MODE ? 'Tải ảnh sẽ có ở bước tiếp theo.' : 'Cần ít nhất 1 ảnh (JPEG/PNG/WebP) khi gửi xác nhận.'}>
        {IS_API_MODE ? (
          <Notice tone="info" title="Ảnh hiện trường">Tải ảnh sẽ có ở bước tiếp theo.</Notice>
        ) : record ? (
          <AttachmentField
            label="Ảnh/tệp hiện trường"
            recordId={record.id}
            purpose="SITE_PHOTO"
            items={photos.items}
            onAdd={photos.add}
            onRemove={photos.remove}
            error={photoFieldError}
            required
            uploadLabel="Thêm ảnh"
            hint="Tệp mới được lưu vào hồ sơ khi bấm “Lưu nháp” hoặc “Gửi xác nhận”."
          />
        ) : (
          <PendingFilesField files={pendingFiles} onChange={setPendingFiles} error={photoFieldError} />
        )}
      </FormSection>
      <FieldErrorList errors={serverErrors} exclude={SHOWN_FIELDS} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" disabled={submitter.isBusy} onClick={() => navigate(record ? `/records/${record.id}` : IS_API_MODE ? '/' : '/records')}>
          Hủy
        </Button>
        <Button variant="secondary" size="lg" isLoading={submitter.pendingIntent === 'draft'} disabled={submitter.isBusy} onClick={form.handleSubmit(onValid('draft'))}>
          Lưu nháp
        </Button>
        {IS_API_MODE ? null : (
          <Button size="lg" isLoading={submitter.pendingIntent === 'submit'} disabled={submitter.isBusy} onClick={form.handleSubmit(onValid('submit'))}>
            Gửi xác nhận
          </Button>
        )}
      </div>
    </form>
  );
};
