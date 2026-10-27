import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { AttachmentPurpose, SubjectType } from '@/domain/constants';
import { LIMITS } from '@/domain/constants';
import type { Attachment } from '@/domain/types';
import { uploadAttachment } from '@/services/file-service';
import { prepareUpload } from '@/services/upload-prep';
import { UploadReport } from './UploadReport';
import { uploadBatch } from './upload-batch';
import type { BatchPhase, BatchResult } from './upload-batch';

interface FileUploaderProps {
  subjectType: SubjectType;
  subjectId: string;
  purpose: AttachmentPurpose;
  onUploaded: (attachments: Attachment[]) => void;
  accept?: string;
  label?: string;
  multiple?: boolean;
  disabled?: boolean;
}

const DEFAULT_ACCEPT = LIMITS.ALLOWED_MIME_TYPES.join(',');

const PHASE_LABEL: Record<BatchPhase, string> = { preparing: 'Đang xử lý ảnh', uploading: 'Đang tải' };

interface Progress {
  phase: BatchPhase;
  position: number;
  total: number;
}

/**
 * Uploads the chosen files one by one (SPEC AT-S1): a refused file never stops the others unless the refusal is about
 * permission or step, large photos are shrunk first, and a round with refused files leaves a report under the button.
 */
export const FileUploader = ({
  subjectType,
  subjectId,
  purpose,
  onUploaded,
  accept = DEFAULT_ACCEPT,
  label = 'Thêm tệp',
  multiple = true,
  disabled = false,
}: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [report, setReport] = useState<BatchResult | null>(null);

  const handleFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    setReport(null);
    try {
      const result = await uploadBatch(files, {
        prepare: (file) => prepareUpload(file),
        upload: (file) => uploadAttachment({ subjectType, subjectId, purpose, file, fileName: file.name }),
        onProgress: (phase, position, total) => setProgress({ phase, position, total }),
      });
      if (result.uploaded.length > 0) onUploaded(result.uploaded);
      if (result.failed.length > 0) setReport(result);
      else toast.success(`Đã tải ${result.total} tệp`);
    } catch (error) {
      // uploadBatch reports each file's error; only a fault outside it (e.g. onUploaded) lands here.
      console.error('Upload round failed:', error);
      toast.error('Không hoàn tất lượt tải tệp. Vui lòng thử lại.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button variant="outline" size="sm" isLoading={progress !== null} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {progress ? null : <Paperclip className="h-4 w-4" />}
        {progress ? `${PHASE_LABEL[progress.phase]} ${progress.position}/${progress.total}…` : label}
      </Button>
      <p className="mt-1 text-xs text-ink-3">JPEG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp. Ảnh lớn sẽ được tự thu nhỏ.</p>
      {report ? <UploadReport result={report} onClose={() => setReport(null)} /> : null}
    </div>
  );
};
