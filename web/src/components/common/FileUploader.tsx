import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { IS_API_MODE } from '@/config/data-source';
import type { AttachmentPurpose, SubjectType } from '@/domain/constants';
import { LIMITS } from '@/domain/constants';
import { toErrorMessage } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import { uploadAttachment } from '@/services/file-service';

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

/** Uploads files to IndexedDB for a subject; reports invalid type/size and quota errors. */
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
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const uploaded: Attachment[] = [];
    let pending: File | undefined;
    try {
      for (const file of Array.from(files)) {
        pending = file;
        uploaded.push(await uploadAttachment({ subjectType, subjectId, purpose, file, fileName: file.name }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      // API mode names the failed file so the user knows which photo was refused; mock messages stay unchanged.
      const message = toErrorMessage(error);
      toast.error(IS_API_MODE && pending ? `${pending.name}: ${message}` : message);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      if (uploaded.length > 0) onUploaded(uploaded);
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
      <Button variant="outline" size="sm" isLoading={isUploading} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Paperclip className="h-4 w-4" />
        {label}
      </Button>
      <p className="mt-1 text-xs text-ink-3">JPEG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp.</p>
    </div>
  );
};
