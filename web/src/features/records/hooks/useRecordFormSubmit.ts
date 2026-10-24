import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { IS_API_MODE } from '@/config/data-source';
import { toErrorMessage } from '@/domain/errors';
import type { FieldErrors } from '@/domain/errors';
import type { RepairRecord } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { uploadAttachment } from '@/services/file-service';
import { toRecordPayload } from '../components/form/record-form-schema';
import type { RecordFormIntent, RecordFormValues } from '../components/form/record-form-schema';

interface Args {
  record?: RepairRecord;
  photoIds: string[];
  pendingFiles: File[];
  /** Errors carried over from the create page when the first submit failed. */
  carriedErrors?: FieldErrors;
}

const uploadPending = async (recordId: string, files: File[]): Promise<string[]> => {
  const ids: string[] = [];
  for (const file of files) {
    try {
      const attachment = await uploadAttachment({ subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose: 'SITE_PHOTO', file, fileName: file.name });
      ids.push(attachment.id);
    } catch (error) {
      console.error('Upload site photo failed:', error);
      toast.error(`${file.name}: ${toErrorMessage(error)}`);
    }
  }
  return ids;
};

/**
 * Create / save / submit flow of the record form.
 * New record: createRecord → upload picked photos → (saveRecordDraft | submitRecord) with their ids.
 */
export const useRecordFormSubmit = ({ record, photoIds, pendingFiles, carriedErrors }: Args) => {
  const navigate = useNavigate();
  const createCommand = useCommand();
  const saveCommand = useCommand();
  const submitCommand = useCommand();
  const [isUploading, setIsUploading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<RecordFormIntent | null>(null);
  const [carried, setCarried] = useState<FieldErrors>(carriedErrors ?? {});

  const saveExisting = async (current: RepairRecord, values: RecordFormValues, intent: RecordFormIntent) => {
    const payload = { ...toRecordPayload(values, current.status === 'DRAFT'), attachmentIds: photoIds };
    const base = { subjectType: 'REPAIR_RECORD' as const, subjectId: current.id, expectedVersion: current.version, payload };
    if (intent === 'draft') {
      const result = await saveCommand.execute({ ...base, action: 'saveRecordDraft' });
      if (result) toast.success('Đã lưu nháp hồ sơ.');
      return;
    }
    const result = await submitCommand.execute({ ...base, action: 'submitRecord' });
    if (!result) return;
    toast.success('Đã gửi hồ sơ cho người xác nhận kỹ thuật.');
    navigate(`/records/${current.id}`);
  };

  const createNew = async (values: RecordFormValues, intent: RecordFormIntent) => {
    const created = await createCommand.execute({
      subjectType: 'REPAIR_RECORD',
      action: 'createRecord',
      payload: { buildingId: values.buildingId, ...toRecordPayload(values, true) },
    });
    const recordId = created?.subjectId;
    if (!recordId) return;
    const code = typeof created.data?.code === 'string' ? created.data.code : '';
    setIsUploading(true);
    const ids = await uploadPending(recordId, pendingFiles);
    setIsUploading(false);
    const base = { subjectType: 'REPAIR_RECORD' as const, subjectId: recordId, expectedVersion: 1, payload: { attachmentIds: ids } };
    if (intent === 'submit') {
      const submitted = await submitCommand.execute({ ...base, action: 'submitRecord' });
      if (submitted) {
        toast.success(`Đã tạo và gửi hồ sơ ${code}.`);
        navigate(`/records/${recordId}`, { replace: true });
        return;
      }
      toast.info(`Hồ sơ ${code} đã được lưu nháp. Hãy bổ sung rồi gửi lại.`);
      // Keep the field errors of the failed submit visible on the edit page.
      navigate(`/records/${recordId}/edit`, { replace: true, state: { fieldErrors: submitCommand.getLastFieldErrors() } });
      return;
    } else {
      if (ids.length > 0) await saveCommand.execute({ ...base, action: 'saveRecordDraft' });
      toast.success(`Đã tạo hồ sơ nháp ${code}.`);
    }
    // API mode lands on the detail screen (T1 behaviour); the demo keeps its edit step.
    navigate(IS_API_MODE ? `/records/${recordId}` : `/records/${recordId}/edit`, { replace: true });
  };

  const save = async (values: RecordFormValues, intent: RecordFormIntent) => {
    setPendingIntent(intent);
    setCarried({});
    try {
      if (record) await saveExisting(record, values, intent);
      else await createNew(values, intent);
    } catch (error) {
      console.error('Record form submit failed:', error);
      toast.error(toErrorMessage(error));
    } finally {
      setPendingIntent(null);
      setIsUploading(false);
    }
  };

  const fieldErrors: FieldErrors = { ...carried, ...createCommand.fieldErrors, ...saveCommand.fieldErrors, ...submitCommand.fieldErrors };
  const isBusy = isUploading || createCommand.isPending || saveCommand.isPending || submitCommand.isPending || pendingIntent !== null;
  return { save, fieldErrors, isBusy, pendingIntent };
};
