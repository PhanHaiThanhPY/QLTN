import { useRef } from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { LIMITS } from '@/domain/constants';

interface PendingFilesFieldProps {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
}

const isAllowed = (file: File): boolean =>
  (LIMITS.ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) && file.size > 0 && file.size <= LIMITS.MAX_FILE_BYTES;

/** Site photos picked before the record exists; they are uploaded right after createRecord. */
export const PendingFilesField = ({ files, onChange, error }: PendingFilesFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handlePick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const valid = picked.filter(isAllowed);
    if (valid.length < picked.length) toast.error('Một số tệp bị bỏ qua: chỉ nhận JPEG/PNG/WebP/PDF, tối đa 10 MB/tệp.');
    if (valid.length > 0) onChange([...files, ...valid]);
    if (inputRef.current) inputRef.current.value = '';
  };
  return (
    <Field label="Ảnh hiện trường" required error={error} hint="Tệp được tải lên ngay sau khi hồ sơ nháp được tạo.">
      {files.length === 0 ? <p className="text-sm text-ink-3">Chưa chọn tệp.</p> : null}
      <ul className="flex flex-wrap gap-2">
        {files.map((file, index) => {
          const Icon = file.type.startsWith('image/') ? ImageIcon : FileText;
          return (
            <li key={`${file.name}-${index}`} className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-2 py-1.5 pl-2.5 pr-1 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="rounded p-1 text-ink-3 hover:bg-surface-3"
                aria-label={`Bỏ ${file.name}`}
                onClick={() => onChange(files.filter((_, position) => position !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={LIMITS.ALLOWED_MIME_TYPES.join(',')}
        onChange={(event) => handlePick(event.target.files)}
      />
      <div>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
          Chọn ảnh/tệp
        </Button>
        <p className="mt-1 text-xs text-ink-3">JPEG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp.</p>
      </div>
    </Field>
  );
};
