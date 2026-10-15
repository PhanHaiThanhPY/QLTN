import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect } from '@/components/ui/input';
import { CHECK_RESULT_LABEL } from '@/domain/constants';
import type { CheckResult } from '@/domain/constants';
import type { Attachment, MaintenanceChecklistEntry } from '@/domain/types';
import { pickAttachments } from './ChecklistEntriesView';

const RESULT_OPTIONS: CheckResult[] = ['NOT_CHECKED', 'OK', 'ISSUE', 'NOT_APPLICABLE'];

interface ChecklistEntryEditorProps {
  index: number;
  entry: MaintenanceChecklistEntry;
  occurrenceId: string;
  attachmentsById: Map<string, Attachment>;
  serverError?: string;
  onResult: (result: CheckResult) => void;
  onNote: (note: string) => void;
  onFiles: (files: Attachment[]) => void;
  onRemoveFile: (id: string) => void;
}

/** One checklist answer: result, note (required for ISSUE / NOT_APPLICABLE) and optional photos. */
export const ChecklistEntryEditor = ({
  index,
  entry,
  occurrenceId,
  attachmentsById,
  serverError,
  onResult,
  onNote,
  onFiles,
  onRemoveFile,
}: ChecklistEntryEditorProps) => {
  const needsNote = entry.result === 'ISSUE' || entry.result === 'NOT_APPLICABLE';
  const missingNote = needsNote && !entry.note?.trim();
  const optionLabel = (result: CheckResult) => (result === 'NOT_CHECKED' && !entry.required ? 'Không kiểm tra' : CHECK_RESULT_LABEL[result]);
  return (
    <li className="space-y-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start gap-2 text-sm text-ink">
        <span className="text-ink-3">{index + 1}.</span>
        <span className="min-w-0 flex-1">{entry.label}</span>
        {entry.required ? <Badge tone="accent">Bắt buộc</Badge> : <Badge tone="outline">Tùy chọn</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_1fr]">
        <NativeSelect
          aria-label={`Kết quả mục ${index + 1}`}
          value={entry.result}
          aria-invalid={Boolean(serverError)}
          onChange={(event) => onResult(event.target.value as CheckResult)}
        >
          {RESULT_OPTIONS.map((result) => (
            <option key={result} value={result}>
              {optionLabel(result)}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label={`Ghi chú mục ${index + 1}`}
          placeholder={needsNote ? 'Ghi chú lý do (bắt buộc)' : 'Ghi chú (tùy chọn)'}
          value={entry.note ?? ''}
          aria-invalid={missingNote}
          maxLength={1000}
          onChange={(event) => onNote(event.target.value)}
        />
      </div>
      {missingNote ? <p className="text-xs text-warn">Kết quả “{CHECK_RESULT_LABEL[entry.result]}” cần ghi chú lý do.</p> : null}
      {serverError ? (
        <p className="text-xs text-crit" role="alert">
          {serverError}
        </p>
      ) : null}
      {entry.attachmentIds.length > 0 ? (
        <AttachmentList attachments={pickAttachments(entry.attachmentIds, attachmentsById)} onRemove={onRemoveFile} />
      ) : null}
      <FileUploader
        subjectType="MAINTENANCE_OCCURRENCE"
        subjectId={occurrenceId}
        purpose="MAINTENANCE_RESULT"
        label="Ảnh cho mục này"
        onUploaded={onFiles}
      />
    </li>
  );
};
